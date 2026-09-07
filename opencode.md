




```bash
sudo -i
curl -fsSL https://opencode.ai/install | bash
source ~/.bashrc


mkdir -p ~/.config/opencode
vi ~/.config/opencode/opencode.json
```

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": "allow"
}
```


# start

```bash
opencode web --hostname 0.0.0.0
```


