# User Management

## Creating the initial admin user

After deployment, `create_manager_service.js` automatically creates an `admin` user with a random password, which is printed once to the deployment log. To add more users or change passwords, use `register.js` from the manager's deployment directory:

```bash
cd /path/to/deployment/manager

# Add a new user
node register.js newuser "StrongPassword123!"

# Change an existing user's password (just run register.js again with the same username)
node register.js admin "NewPassword456!"
```

## User storage

Credentials are stored as bcrypt hashes in `src/config/users.json`. This file is git-ignored and must never be committed.

## Revoking a user

Edit `src/config/users.json` and remove the user's entry, then restart the manager:

```bash
# Example users.json with one entry removed
# Restart the manager to apply
sudo systemctl restart your-instance-manager.service
```

## Session tokens

Sessions use stateless JWT tokens signed with `JWT_SECRET`. After changing `JWT_SECRET`, all existing sessions are immediately invalidated (users must log in again). This is the recommended revocation mechanism for incidents.

```bash
# Rotate the JWT secret — invalidates ALL active sessions
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
sudo systemctl restart your-instance-manager.service
```
