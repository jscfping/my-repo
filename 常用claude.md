




# 相關工作過程可以記錄在`workdir/.claude.md`，並且可以在裡面記載其他檔案讓claude去鉤


# 常見指示
- 跑指令優先用自動批准的工具，減少打斷 user
- 所有記憶、指示統一寫在 CLAUDE.md，不要拆到 memory 檔案
- Bash 指令不要用管道（`|`），分開跑各指令，由 Claude 自己解讀結果（避免管道指令不符合權限 allow 規則）

## `workdir/.claude/settings.json`
```json
{
  "permissions": {
    "allow": [
      "Bash(git:*)",
      "Bash(curl:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(find:*)",
      "Bash(grep:*)",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(echo:*)",
      "Bash(mkdir:*)",
      "Bash(touch:*)",
      "Bash(chmod:*)"
    ],
    "ask": [
      "Bash(git push:*)"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(sudo:*)"
    ]
  }
}
```


# js、ts字串使用雙引號

# 一行宣告一個變數






