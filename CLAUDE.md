# Bluetooth Mouse Bridge Project

## Project Overview

This project builds a **Bluetooth Mouse Bridge** that captures mouse input from a Mac and re-transmits it as BLE HID mouse events to an iPhone or Android phone, using an ESP32 as the Bluetooth bridge.

```
Mac (Python) --USB Serial--> ESP32 (Arduino C++) --BLE HID--> iPhone/Android
```

## Architecture Decision

**Option A (ESP32 + NimBLE)** has been selected as the recommended architecture. See `ARCHITECTURE.md` for full details and alternatives evaluated.

## Technology Stack

| Component | Technology | Key Libraries |
|-----------|-----------|---------------|
| **ESP32 Firmware** | Arduino C++ (PlatformIO or Arduino IDE) | `ESP32-NimBLE-Mouse` |
| **Mac App** | Python 3 | `pyobjc-framework-Quartz`, `pyserial` |
| **Protocol** | 5-byte binary packets @ 115200 baud | Custom (see ARCHITECTURE.md) |
| **Hardware** | ESP32-WROOM-32 DevKit | Built-in BLE, USB serial |

## Session Instructions

### IMPORTANT: Requirements Gathering Phase

Before writing ANY implementation code, you MUST first gather detailed requirements from the user using the `AskUserQuestion` tool. The full list of questions to ask is in `session_context.md` under "Requirements to Gather".

**Workflow:**
1. Read `session_context.md` to understand project state and pending questions
2. Use `AskUserQuestion` to ask the user each requirement question (one at a time or in small groups)
3. Record all answers back into `session_context.md`
4. Build a detailed implementation plan based on answers
5. Present the plan and wait for user confirmation
6. Only then begin implementation

### Project Structure (Target)

```
bluetooth-mouse-bridge/
├── CLAUDE.md                  # This file
├── ARCHITECTURE.md            # Architecture decisions and research
├── session_context.md         # Session state and requirements
├── esp32/                     # ESP32 firmware
│   ├── platformio.ini         # PlatformIO config (or .ino for Arduino IDE)
│   └── src/
│       └── main.cpp           # ESP32 BLE mouse bridge firmware
├── mac/                       # Mac-side Python application
│   ├── requirements.txt       # Python dependencies
│   ├── mouse_bridge.py        # Main bridge script
│   └── config.py              # Configuration (serial port, sensitivity, etc.)
└── README.md                  # Setup and usage instructions
```

### Coding Guidelines

- ESP32: Use Arduino framework with NimBLE stack
- Mac: Python 3.9+, use Quartz CGEventTap for mouse capture (only method providing true hardware deltas)
- Serial protocol: 5-byte binary packets (0xAA header, buttons, dx, dy, scroll)
- Baud rate: 115200 (ESP32 default FIFO threshold = 1 byte at this rate)
- Keep it simple — this is a focused utility, not a framework

### Key Technical Constraints

- macOS requires Accessibility/Input Monitoring permissions for CGEventTap
- iOS requires BLE HID bonding with encryption (handled by ESP32-NimBLE-Mouse library)
- iOS mouse support: iOS 13+ via Accessibility > AssistiveTouch; iPadOS 13.4+ native
- Android mouse support: Android 4.4+ native
- Use ESP32-WROOM-32 (not ESP32-C3) for maximum BLE compatibility
- Keep serial port open for lifetime of app (macOS Sequoia adds ~2s overhead per open/close)
