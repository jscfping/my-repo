




```bash
ssh n102@192.168.1.107
sudo -i

curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v

npm install -g zcode-app-cli@latest
zcode --version
zcode --mode yolo



npm install -g @aixyzstudio/zcode-webui
zcode-webui setup --yes
zcode-webui start
fuser -k 3142/tcp
```