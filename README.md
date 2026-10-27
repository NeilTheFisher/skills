# skills

Neil's public agent skills: generic engineering workflows plus skills vendored
from public upstreams (mattpocock/skills, cloudflare/skills, dzhng/skills,
t3dotgg/tstack, and others). Vendored licenses live in `licenses/`.

Internal / machine-specific skills live in the private `skills-private` repo,
which is checked out here as the `private/` git submodule. After cloning:

```bash
git clone --recurse-submodules https://github.com/NeilTheFisher/skills.git ~/.agents/skills
~/.agents/skills/scripts/link-private-skills.sh   # symlink private skills into the flat root
```

The symlinks are gitignored, so this public repo never contains private skill
content. `scripts/link-private-skills.sh` is idempotent; re-run it after adding a
private skill.
