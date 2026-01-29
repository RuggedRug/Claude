# Session Context — Bluetooth Mouse Bridge

## Current Status

**Phase:** Requirements Gathering (NOT YET STARTED)
**Next Step:** Use `AskUserQuestion` tool to gather all requirements below, then build implementation plan.

---

## Decisions Already Made

1. **Architecture:** Option A — ESP32-WROOM-32 + NimBLE (selected as easiest/cheapest)
2. **Mac capture method:** Quartz CGEventTap (only method providing true relative deltas)
3. **Serial protocol:** 5-byte binary packets @ 115200 baud
4. **ESP32 library:** ESP32-NimBLE-Mouse
5. **Mac language:** Python 3 with pyobjc-framework-Quartz + pyserial
6. **Direct Mac Bluetooth rejected:** macOS cannot reliably act as BLE HID peripheral; iOS blocks HID service advertisement from apps

---

## Requirements to Gather

Use `AskUserQuestion` for each section below. After each answer, update the "Answer" field.

### 1. Target Devices

**Q1.1:** Which phones do you need to support? (iPhone only / Android only / both)
- Answer: _PENDING_

**Q1.2:** What is the minimum iOS version you need? (e.g., iOS 15+, or as far back as iOS 13)
- Answer: _PENDING_

**Q1.3:** What is the minimum Android version you need? (e.g., Android 10+, or as far back as possible)
- Answer: _PENDING_

### 2. Mouse Features

**Q2.1:** Which mouse actions do you need? (check all that apply)
- [ ] Left click
- [ ] Right click
- [ ] Middle click
- [ ] Scroll wheel (vertical)
- [ ] Horizontal scroll (pan)
- [ ] Back/Forward buttons
- Answer: _PENDING_

**Q2.2:** Do you need adjustable cursor speed / sensitivity? (yes/no)
- Answer: _PENDING_

**Q2.3:** Do you need a "capture mode" that locks the Mac cursor in place while bridging? (yes/no — useful so your Mac cursor doesn't fly off-screen)
- Answer: _PENDING_

### 3. Mac-Side Software

**Q3.1:** Should the Mac app have a GUI (menu bar icon, settings window) or is a terminal-only CLI script sufficient?
- Answer: _PENDING_

**Q3.2:** Do you need auto-detection of the ESP32 serial port, or is manually entering the port path acceptable?
- Answer: _PENDING_

**Q3.3:** Do you want a keyboard hotkey to start/stop the mouse bridge? If yes, what key combo? (e.g., Ctrl+Shift+M)
- Answer: _PENDING_

**Q3.4:** Should the Mac script support a configuration file for settings (port, sensitivity, etc.) or are command-line arguments sufficient?
- Answer: _PENDING_

### 4. ESP32 Firmware

**Q4.1:** Do you prefer Arduino IDE or PlatformIO for building/flashing the ESP32?
- Answer: _PENDING_

**Q4.2:** Should the BLE device name be configurable (e.g., via serial command) or is a hardcoded name fine?
- Answer: _PENDING_

**Q4.3:** Do you want an LED status indicator on the ESP32? (e.g., blinking = advertising/waiting, solid = connected to phone)
- Answer: _PENDING_

**Q4.4:** Should the ESP32 auto-reconnect to the last paired phone, or require manual re-pairing each time?
- Answer: _PENDING_

### 5. Project Structure & Quality

**Q5.1:** Do you want both Mac and ESP32 code in this same repo (monorepo) or separate repos?
- Answer: _PENDING_

**Q5.2:** Do you need a setup/install script for the Mac Python dependencies?
- Answer: _PENDING_

**Q5.3:** Do you want unit tests? (for the Python side at minimum)
- Answer: _PENDING_

**Q5.4:** Do you need a README with setup instructions?
- Answer: _PENDING_

### 6. Scope & Priority

**Q6.1:** Is this a prototype/proof-of-concept or intended for daily use?
- Answer: _PENDING_

**Q6.2:** What's most important: getting it working fast (MVP) or having clean/extensible code?
- Answer: _PENDING_

**Q6.3:** Are there any features you consider "nice to have" vs "must have"? List them.
- Answer: _PENDING_

---

## Implementation Plan

_TO BE CREATED after requirements are gathered. Will include:_
- [ ] Detailed task breakdown with dependencies
- [ ] File-by-file implementation order
- [ ] Testing strategy
- [ ] Estimated complexity per component

---

## Reference: Data Flow

```
Mac mouse hardware event
  → macOS kernel
  → Quartz CGEventTap callback (Python)
  → Extract kCGMouseEventDeltaX / DeltaY
  → Clamp to int8 range
  → Pack into 5-byte binary packet [0xAA, buttons, dx, dy, scroll]
  → pyserial write to /dev/cu.usbserial-XXXX
  → ESP32 Serial.read() receives bytes
  → Parse packet, extract fields
  → bleMouse.move(dx, dy, scroll) / bleMouse.press() / bleMouse.release()
  → BLE HID report sent over air
  → Phone receives HID input
  → Phone cursor moves
```

## Reference: Serial Packet Format

```
Byte 0: 0xAA        — sync/header
Byte 1: buttons      — bitmask (bit0=left, bit1=right, bit2=middle)
Byte 2: dx           — int8_t X delta (-128..127)
Byte 3: dy           — int8_t Y delta (-128..127)
Byte 4: scroll       — int8_t scroll wheel (-128..127)
```

## Reference: Key Links

- ESP32-NimBLE-Mouse: https://github.com/wakwak-koba/ESP32-NimBLE-Mouse
- ESP32-BLE-Mouse (Bluedroid): https://github.com/T-vK/ESP32-BLE-Mouse
- pyobjc Quartz: https://pypi.org/project/pyobjc-framework-Quartz/
- pyserial: https://pypi.org/project/pyserial/
- ESP32 Arduino core: https://docs.espressif.com/projects/arduino-esp32/en/latest/
- Apple CGEventTap docs: https://developer.apple.com/documentation/coregraphics/1454426-cgeventtapcreate
