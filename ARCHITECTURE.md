# Bluetooth Mouse Bridge - Architecture Proposal

## Goal

Build a system where a **Mac** captures mouse input, sends it over **USB serial** to an **Arduino-compatible microcontroller**, which re-transmits it as **BLE HID mouse events** to an **iPhone or Android phone**.

```
┌─────────┐   USB Serial   ┌────────────┐   BLE HID    ┌──────────────┐
│   Mac   │ ──────────────> │  Arduino/  │ ───────────> │ iPhone /     │
│ (mouse  │   115200 baud   │  ESP32     │   Mouse      │ Android      │
│ capture)│   binary pkts   │  (bridge)  │   Profile    │ (HID host)   │
└─────────┘                 └────────────┘              └──────────────┘
```

---

## Three Architecture Options (ranked by ease)

### Option A: ESP32 + NimBLE (Recommended)

**Difficulty: Easiest | Cost: ~$5 | Community: Largest**

| Component | Technology |
|-----------|-----------|
| Board | ESP32 DevKit (~$3-5) |
| BLE Stack | NimBLE (42% less Flash than Bluedroid) |
| Library | [ESP32-NimBLE-Mouse](https://github.com/wakwak-koba/ESP32-NimBLE-Mouse) |
| IDE | Arduino IDE or PlatformIO |

**Why this is best:**
- Built-in WiFi + BLE — no external modules needed
- Drop-in `BleMouse` API: `bleMouse.move(dx, dy, scroll)`
- Cheapest hardware option
- Largest community, most GitHub examples
- Confirmed working with iOS 13+ and Android 4.4+
- NimBLE stack saves ~42% Flash, supports BLE 5.4

**Tradeoffs:**
- ESP32-C3 variants have reported BLE advertising issues on some Android devices
- Stick with standard ESP32 (ESP32-WROOM-32) for maximum compatibility

---

### Option B: Adafruit nRF52840 Feather (Bluefruit)

**Difficulty: Easy | Cost: ~$25 | Community: Strong (Adafruit)**

| Component | Technology |
|-----------|-----------|
| Board | Adafruit Feather nRF52840 Express (~$25) |
| BLE Stack | SoftDevice (Nordic) |
| Library | [BLEHidAdafruit](https://learn.adafruit.com/introducing-the-adafruit-nrf52840-feather/blehidadafruit) (first-party) |
| IDE | Arduino IDE or CircuitPython |

**Why consider this:**
- Best-documented BLE HID support (first-party Adafruit library)
- Can use CircuitPython — no compilation, just edit `.py` files
- Dual USB HID + BLE HID simultaneously via TinyUSB
- Central + Peripheral mode (could receive BLE HID from one device and re-transmit)
- nRF52840 is the gold standard chip for BLE

**Tradeoffs:**
- 5x more expensive than ESP32
- Smaller community than ESP32 (but better docs)

---

### Option C: Arduino Nano 33 BLE

**Difficulty: Moderate | Cost: ~$23 | Community: Limited**

| Component | Technology |
|-----------|-----------|
| Board | Arduino Nano 33 BLE (~$23) |
| BLE Stack | Mbed OS |
| Library | [mbed-ble-hid](https://github.com/tcoppex/mbed-ble-hid) (third-party, single maintainer) |
| IDE | Arduino IDE |

**Why consider this:**
- Official Arduino form factor
- Uses nRF52840 chip (same as Adafruit)

**Tradeoffs:**
- Standard `ArduinoBLE` library does NOT support pairing (required for HID)
- Only one third-party library available (single maintainer)
- Standard Arduino `Mouse.h` does NOT work on this board
- Higher risk of breakage with library updates

---

## Mac-Side Software

### Mouse Capture: Quartz CGEventTap (Only correct approach)

Other libraries (PyAutoGUI, pynput) only provide **absolute** cursor positions. For a mouse bridge you need **true relative deltas** — only macOS Quartz provides this.

```python
import Quartz
import serial
import struct

SERIAL_PORT = '/dev/cu.usbserial-XXXX'  # adjust for your board
BAUD_RATE = 115200
HEADER = 0xAA

ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0)

def mouse_callback(proxy, event_type, event, refcon):
    dx = Quartz.CGEventGetIntegerValueField(event, Quartz.kCGMouseEventDeltaX)
    dy = Quartz.CGEventGetIntegerValueField(event, Quartz.kCGMouseEventDeltaY)

    # Clamp to int8 range (-128 to 127)
    dx = max(-128, min(127, dx))
    dy = max(-128, min(127, dy))

    buttons = 0
    if event_type in (Quartz.kCGEventLeftMouseDragged,):
        buttons |= 0x01
    if event_type in (Quartz.kCGEventRightMouseDragged,):
        buttons |= 0x02

    # Send binary packet: [header, buttons, dx, dy, scroll]
    packet = struct.pack('BBbbB', HEADER, buttons, dx, dy, 0)
    ser.write(packet)

    return event

# Listen for mouse move + drag events
event_mask = (
    (1 << Quartz.kCGEventMouseMoved) |
    (1 << Quartz.kCGEventLeftMouseDragged) |
    (1 << Quartz.kCGEventRightMouseDragged) |
    (1 << Quartz.kCGEventLeftMouseDown) |
    (1 << Quartz.kCGEventLeftMouseUp) |
    (1 << Quartz.kCGEventRightMouseDown) |
    (1 << Quartz.kCGEventRightMouseUp)
)

tap = Quartz.CGEventTapCreate(
    Quartz.kCGSessionEventTap,
    Quartz.kCGHeadInsertEventTap,
    Quartz.kCGEventTapOptionListenOnly,
    event_mask,
    mouse_callback,
    None
)

if tap is None:
    print("ERROR: Could not create event tap.")
    print("Grant Accessibility permissions in System Settings > Privacy & Security > Input Monitoring")
    exit(1)

source = Quartz.CFMachPortCreateRunLoopSource(None, tap, 0)
loop = Quartz.CFRunLoopGetCurrent()
Quartz.CFRunLoopAddSource(loop, source, Quartz.kCFRunLoopDefaultMode)
Quartz.CGEventTapEnable(tap, True)

print("Mouse bridge running. Press Ctrl+C to stop.")
Quartz.CFRunLoopRun()
```

**Requirements:**
```
pip install pyobjc-framework-Quartz pyserial
```

**macOS permissions:** System Settings > Privacy & Security > Input Monitoring — add your terminal or Python.

**Advanced: Cursor lock mode**
```python
# Decouple cursor from mouse so movements are captured without moving the Mac cursor
Quartz.CGAssociateMouseAndMouseCursorPosition(False)
# Re-enable when done
Quartz.CGAssociateMouseAndMouseCursorPosition(True)
```

---

## Serial Protocol

### Binary packet format (5 bytes, fixed-length)

```
Byte 0: 0xAA (sync/header byte)
Byte 1: Button bitmask
         bit 0 = left button
         bit 1 = right button
         bit 2 = middle button
Byte 2: X delta (int8_t, -128 to +127)
Byte 3: Y delta (int8_t, -128 to +127)
Byte 4: Scroll wheel (int8_t, -128 to +127)
```

At 115200 baud (8N1 = 10 bits/byte): 5 bytes = **0.43ms** per packet — negligible latency.

### Why 115200 baud?

On ESP32, baud rates above 115200 set the RX FIFO threshold to **120 bytes** by default, meaning the ESP32 waits for 120 bytes before processing. At 115200 the threshold is 1 byte (immediate processing). If you need higher baud rates, call:

```cpp
Serial.setRxFIFOFull(1);  // Process each byte immediately
```

---

## ESP32 Firmware (Option A — recommended)

```cpp
#include <BleMouseNimble.h>  // ESP32-NimBLE-Mouse library

BleMouse bleMouse("CustomMouse", "MyMfg", 100);

const uint8_t HEADER = 0xAA;
uint8_t buf[5];
int bufIdx = 0;

void setup() {
    Serial.begin(115200);
    bleMouse.begin();
}

void loop() {
    // Read serial packets from Mac
    while (Serial.available()) {
        uint8_t b = Serial.read();

        if (bufIdx == 0 && b != HEADER) {
            continue;  // Wait for sync byte
        }

        buf[bufIdx++] = b;

        if (bufIdx == 5) {
            bufIdx = 0;

            if (bleMouse.isConnected()) {
                uint8_t buttons = buf[1];
                int8_t dx       = (int8_t)buf[2];
                int8_t dy       = (int8_t)buf[3];
                int8_t scroll   = (int8_t)buf[4];

                // Handle button state changes
                if (buttons & 0x01) bleMouse.press(MOUSE_LEFT);
                else                bleMouse.release(MOUSE_LEFT);

                if (buttons & 0x02) bleMouse.press(MOUSE_RIGHT);
                else                bleMouse.release(MOUSE_RIGHT);

                if (buttons & 0x04) bleMouse.press(MOUSE_MIDDLE);
                else                bleMouse.release(MOUSE_MIDDLE);

                // Send movement
                bleMouse.move(dx, dy, scroll);
            }
        }
    }
}
```

---

## Phone-Side Setup

### iOS (iPhone / iPad)

| iOS Version | How to enable |
|-------------|--------------|
| iOS 13+ (iPhone) | Settings > Accessibility > Touch > AssistiveTouch > ON, then pair BLE device in Bluetooth settings |
| iPadOS 13.4+ (iPad) | Native — just pair in Bluetooth settings, cursor appears automatically |

**BLE HID requirements for iOS:**
- Must include HID Service (0x1812), Battery Service (0x180F), Device Information Service (0x180A)
- Bonding with encryption is mandatory
- The ESP32-BLE-Mouse / NimBLE libraries handle all of this automatically

### Android

| Android Version | Support |
|----------------|---------|
| Android 4.4+ (KitKat, 2013) | BLE HID over GATT (HOGP) natively supported |

Just pair in Bluetooth settings — mouse cursor appears automatically. No special configuration needed.

---

## Recommendation

**Go with Option A (ESP32 + NimBLE).** Here's the shopping list and setup:

### Hardware (~$5-10 total)
- 1x ESP32-WROOM-32 DevKit (not ESP32-C3)
- 1x USB cable (Micro-USB or USB-C depending on board)

### Software setup

**Mac side:**
```bash
pip install pyobjc-framework-Quartz pyserial
```

**ESP32 side (Arduino IDE):**
1. Install ESP32 board support: `https://dl.espressif.com/dl/package_esp32_index.json`
2. Install library: `ESP32-NimBLE-Mouse` (Library Manager or [GitHub](https://github.com/wakwak-koba/ESP32-NimBLE-Mouse))
3. Flash the firmware sketch above

### End-to-end flow
1. Flash ESP32 with firmware
2. Pair ESP32 with phone (appears as "CustomMouse" in Bluetooth)
3. Connect ESP32 to Mac via USB
4. Run the Python script on Mac
5. Move your Mac mouse — cursor moves on phone

### Latency budget
| Segment | Latency |
|---------|---------|
| Mac mouse event → Python callback | ~1ms |
| Serial TX (5 bytes @ 115200) | ~0.4ms |
| ESP32 serial RX + processing | ~1ms |
| BLE HID report (15ms connection interval) | ~7.5-15ms |
| **Total end-to-end** | **~10-18ms** |

This is well within interactive/real-time thresholds (a typical USB mouse itself operates at 8ms / 125Hz).
