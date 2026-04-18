# Project History — Bluetooth Mouse Bridge POC

## Goal

Build a Proof-of-Concept that emulates a Bluetooth mouse, allowing a **Mac Mini** to control the cursor on a mobile device (**Samsung Galaxy S24** or **iPhone**) over Bluetooth.

```
┌─────────────┐   USB Serial   ┌────────────┐   BLE HID    ┌──────────────────┐
│  Mac Mini   │ ──────────────> │   ESP32    │ ───────────> │ Samsung S24 /    │
│ (Python +   │   115200 baud   │  (Arduino  │   Mouse      │ iPhone           │
│  Quartz)    │   binary pkts   │   C++)     │   Profile    │ (HID host)       │
└─────────────┘                 └────────────┘              └──────────────────┘
```

---

## Timeline of Decisions

### Phase 1 — Initial Architecture Research

**Question evaluated:** What's the easiest and fastest way to build a custom Bluetooth mouse for iPhone/Android using Arduino + Mac?

**Three options researched:**

| Option | Hardware | Cost | Library | Verdict |
|--------|----------|------|---------|---------|
| **A: ESP32 + NimBLE** | ESP32-WROOM-32 | ~$5 | ESP32-NimBLE-Mouse | ✅ **Selected** |
| B: Adafruit nRF52840 Feather | nRF52840 Feather | ~$25 | BLEHidAdafruit | Better docs but 5× cost |
| C: Arduino Nano 33 BLE | Nano 33 BLE | ~$23 | mbed-ble-hid (one maintainer) | Higher risk |

**Decision:** Option A (ESP32-WROOM-32 + NimBLE) — cheapest, largest community, proven on iOS 13+ and Android 4.4+.

**Output:** `ARCHITECTURE.md` committed to repo.

---

### Phase 2 — Hardware Specification

**Question:** What hardware is required?

**Answer documented:**
- 1× ESP32-WROOM-32 DevKit (~$3-5) — NOT the ESP32-C3 (BLE advertising issues on Android)
- 1× USB cable (Micro-USB or USB-C depending on board)
- Total: under $10
- The USB cable carries both power and serial data — no other components needed.

**Common boards that work:** ESP32-DevKitC, NodeMCU-32S, DOIT ESP32 DevKit V1.

---

### Phase 3 — "No Extra Hardware" Investigation

**Question:** Can the Mac Mini act as the BLE HID device directly, avoiding the ESP32?

**Three approaches evaluated:**

1. **Mac as BLE Peripheral (CoreBluetooth / `bless`)** — Theoretically possible via `CBPeripheralManager`, but:
   - macOS gives limited control over pairing/bonding (required for HID)
   - No proven, maintained implementation exists
   - macOS may silently block HID service UUID (0x1812) advertisement
   - Verdict: **Experimental, unreliable**

2. **WiFi + Companion App** — Send mouse data over UDP to a phone app:
   - Works on Android (via AccessibilityService for event injection)
   - **Does NOT work on iOS** — iOS forbids apps from injecting system pointer events
   - Verdict: **Android-only, dead end for iPhone**

3. **Bluetooth Classic HID via IOBluetooth** — macOS designed as HID host, not device:
   - No public API to register Mac as Bluetooth HID device
   - Would require private/undocumented IOKit drivers
   - Verdict: **Not feasible**

**Conclusion:** The **$5 ESP32 is genuinely the path of least resistance** for cross-platform support (iPhone + Android). Stick with Option A.

---

### Phase 4 — Technology Stack Defined

**ESP32 side:**
- Language: Arduino C++
- Library: [ESP32-NimBLE-Mouse](https://github.com/wakwak-koba/ESP32-NimBLE-Mouse)
- IDE: Arduino IDE or PlatformIO

**Mac side:**
- Language: Python 3.9+
- Capture: Quartz `CGEventTap` (only API providing true hardware deltas via `kCGMouseEventDeltaX/Y`)
- Serial: `pyserial`
- Install: `pip install pyobjc-framework-Quartz pyserial`
- Permission required: System Settings > Privacy & Security > Input Monitoring

**Why Quartz (not PyAutoGUI / pynput):**
- PyAutoGUI: only provides absolute positions, no event listener
- pynput: callbacks give absolute coords, deltas only via undocumented `darwin_intercept`
- Quartz `CGEventTap`: provides true hardware-level relative deltas — what game engines use

**Serial Protocol:**
- 5-byte fixed-length binary packets: `[0xAA, buttons, dx, dy, scroll]`
- Baud: **115200** (ESP32 default 1-byte FIFO threshold; higher rates default to 120-byte threshold which adds latency)
- 0.43ms per packet at 115200 baud

**Latency budget:** ~10-18ms end-to-end (within interactive thresholds; standard USB mouse runs at 8ms / 125Hz).

---

### Phase 5 — Project Files Committed

The following files have been committed to the branch `claude/bluetooth-mouse-bridge-MzLFQ`:

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Full architecture analysis with all 3 options, code samples for Mac and ESP32, latency analysis, phone-side setup instructions |
| `CLAUDE.md` | Project instructions for Claude Code — tech stack, workflow, coding guidelines |
| `session_context.md` | Session state + structured 17-question requirements questionnaire (all marked _PENDING_) |
| `project-history.md` | This file — chronological summary of all decisions made |

---

## What's Still Pending

### Requirements Gathering (NOT STARTED)

The 17 requirement questions in `session_context.md` are all `_PENDING_`. They cover:

1. **Target devices** — iPhone vs Android vs both, OS version minimums
2. **Mouse features** — which clicks, scroll, sensitivity, capture mode
3. **Mac-side software** — GUI vs CLI, port auto-detect, hotkeys, config file
4. **ESP32 firmware** — Arduino IDE vs PlatformIO, device name, LED indicator, auto-reconnect
5. **Project structure** — monorepo, install script, tests, README
6. **Scope & priority** — POC vs production, MVP speed vs clean code

These should be answered using the `AskUserQuestion` tool in Claude Code, then `session_context.md` updated with the answers.

### Implementation (NOT STARTED)

Target structure once requirements are gathered:

```
bluetooth-mouse-bridge/
├── esp32/
│   ├── platformio.ini       (or .ino for Arduino IDE)
│   └── src/main.cpp
├── mac/
│   ├── requirements.txt
│   ├── mouse_bridge.py
│   └── config.py
└── README.md
```

### Hardware Validation (NOT STARTED)

The user still needs to physically:
1. Acquire an ESP32-WROOM-32 DevKit
2. Flash the firmware
3. Pair with Samsung S24 (Android 14+) — should work natively
4. Pair with iPhone — requires Settings > Accessibility > AssistiveTouch
5. Verify cursor movement on both devices

---

## Key Reference Code Snippets

### Mac mouse capture (Python, Quartz)

```python
import Quartz
import serial, struct

ser = serial.Serial('/dev/cu.usbserial-XXXX', 115200, timeout=0)
HEADER = 0xAA

def callback(proxy, event_type, event, refcon):
    dx = Quartz.CGEventGetIntegerValueField(event, Quartz.kCGMouseEventDeltaX)
    dy = Quartz.CGEventGetIntegerValueField(event, Quartz.kCGMouseEventDeltaY)
    dx = max(-128, min(127, dx))
    dy = max(-128, min(127, dy))
    packet = struct.pack('BBbbB', HEADER, 0, dx, dy, 0)
    ser.write(packet)
    return event
```

### ESP32 firmware (Arduino C++)

```cpp
#include <BleMouseNimble.h>
BleMouse bleMouse("CustomMouse", "MyMfg", 100);

void setup() { Serial.begin(115200); bleMouse.begin(); }

void loop() {
    while (Serial.available()) {
        // ... parse 5-byte packet ...
        if (bleMouse.isConnected()) {
            bleMouse.move(dx, dy, scroll);
        }
    }
}
```

---

## Repository State

- **Repo:** RuggedRug/Claude
- **Branch:** `claude/bluetooth-mouse-bridge-MzLFQ`
- **Commits so far:**
  1. Add architecture proposal for Bluetooth mouse bridge
  2. Add CLAUDE.md and session_context.md for Claude Code handoff
  3. Add project-history.md (this file)

## Phone Compatibility Confirmed (in research, not yet hardware-tested)

| Device | OS | Support | Setup |
|--------|----|---------| ------|
| **Samsung Galaxy S24** | Android 14 | ✅ Native BLE HID since Android 4.4 | Just pair in Bluetooth settings — cursor appears |
| **iPhone** (any model running iOS 13+) | iOS 13+ | ✅ Via Accessibility | Settings > Accessibility > Touch > AssistiveTouch > ON, then pair |
| **iPad** | iPadOS 13.4+ | ✅ Native | Just pair, cursor appears automatically |
