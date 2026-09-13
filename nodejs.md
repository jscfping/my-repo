

```bash
sudo -i
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

node --version
npm --version


nohup node index.js 3000 > app.log 2>&1 < /dev/null &
ps aux | grep "node"
```



