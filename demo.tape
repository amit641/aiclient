Output assets/demo.gif
Set FontSize 14
Set Width 900
Set Height 520
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms
Set Padding 16
Set Shell zsh

Hide
Type "cd ~/Desktop/interview_preparation/aiclient-demo" Enter
Sleep 500ms
Type "clear" Enter
Sleep 500ms
Show

Sleep 500ms
Type "# aiclientjs — one function, any model, zero deps" Enter
Sleep 1s

Type "# ---------- 1. Basic text completion ----------" Enter
Sleep 400ms
Type "cat basic.mjs" Enter
Sleep 2s

Type "node basic.mjs" Enter
Sleep 35s

Type "" Enter
Type "# ---------- 2. Streaming response ----------" Enter
Sleep 400ms
Type "cat stream.mjs" Enter
Sleep 2s

Type "node stream.mjs" Enter
Sleep 10s

Type "" Enter
Type "# ---------- 3. Structured JSON output ----------" Enter
Sleep 400ms
Type "cat structured.mjs" Enter
Sleep 2.5s

Type "node structured.mjs" Enter
Sleep 25s

Type "" Enter
Type "# ---------- 4. Preconfigured client ----------" Enter
Sleep 400ms
Type "cat client.mjs" Enter
Sleep 2s

Type "node client.mjs" Enter
Sleep 10s

Type "" Enter
Type "# Zero dependencies. 8KB gzipped. npm install aiclientjs" Enter
Sleep 3s
