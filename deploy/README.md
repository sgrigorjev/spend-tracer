# Deploy

Pull-based deployment for the Docker stack on the OCI server. The server polls origin and redeploys when `main` moves; GitHub never connects in, so no deploy key lives in the repo.

## How it works

`deploy.sh` fetches origin, compares `HEAD` with the upstream branch, and exits if they match. On a new commit it pulls with `--ff-only`, rebuilds and restarts the stack, prunes dangling images, and prints the container status. A systemd timer runs it every 5 minutes.

`.env` and `data/` are git-ignored, so a pull never touches them.

## Install

One-time setup on the server. Get the code over SSH so the repo can stay private. Add the server's public key on GitHub first, as a deploy key or on an account.

```sh
# fresh checkout
git clone git@github.com:sgrigorjev/spend-tracer.git ~/projects/spend-tracer

# or, on an existing HTTPS checkout, just switch the remote
git -C ~/projects/spend-tracer remote set-url origin git@github.com:sgrigorjev/spend-tracer.git
```

Then, from the repo root:

```sh
cp .env.example .env
nano .env
docker compose up -d --build

sudo usermod -aG docker ubuntu   # re-login if this changed anything
chmod +x deploy/deploy.sh
sudo systemctl link "$PWD/deploy/systemd/spend-tracer-deploy.service"
sudo systemctl link "$PWD/deploy/systemd/spend-tracer-deploy.timer"
sudo systemctl daemon-reload
sudo systemctl enable --now spend-tracer-deploy.timer
systemctl list-timers spend-tracer-deploy.timer
```

The units are linked, not copied, so a `git pull` that changes them takes effect after `systemctl daemon-reload`. To install copies instead, replace the two `systemctl link` calls with `sudo cp deploy/systemd/spend-tracer-deploy.* /etc/systemd/system/`.

The units assume the checkout is at `/home/ubuntu/projects/spend-tracer` and the deploy user is `ubuntu`. Edit both files if your paths differ.

## Upgrading an existing install

A server that already runs the bot from the previous `bot/.env` layout needs two one-time steps before the next deploy:

```sh
# move the environment file from bot/ back to the repo root
mv bot/.env .env

# let the non-root container write to the data directory
sudo chown -R 1000:1000 data/
```

## Manual runs

```sh
# deploy the latest main now, without waiting for the timer
sudo systemctl start spend-tracer-deploy.service

# force a rebuild even when the checkout already matches origin
~/projects/spend-tracer/deploy/deploy.sh --force

journalctl -u spend-tracer-deploy.service -n 50
```

Use `start`, not `restart`: `restart` kills an in-flight deploy and starts it again.

## Cron alternative

If systemd is not an option:

```cron
*/5 * * * * flock -n /tmp/spend-tracer-deploy.lock /home/ubuntu/projects/spend-tracer/deploy/deploy.sh >> /var/log/spend-tracer-deploy.log 2>&1
```
