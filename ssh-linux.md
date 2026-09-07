


```bash
sudo apt update
sudo apt install openssh-server
sudo systemctl enable --now ssh

systemctl status ssh

hostname -I #ip

sudo ufw allow ssh #firewall
```


```bash
ssh-keygen -R 192.168.1.101
ssh n102@192.168.1.101
```



