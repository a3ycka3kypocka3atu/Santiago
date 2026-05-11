#!/usr/bin/env python3
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request


WORKDIR = pathlib.Path("/Users/andrij/Documents/Codex/2026-04-23-files-mentioned-by-the-user-minimax")
NODE_BIN = pathlib.Path("/Applications/Codex.app/Contents/Resources/node")
NPM_HOME = pathlib.Path(os.path.expanduser("~/.local/share/codex-bootstrap/npm"))
NPM_PREFIX = pathlib.Path(os.path.expanduser("~/.npm-global"))
SETUP_SCRIPT = WORKDIR / "setup_minimax_antigravity.py"


def fetch_json(url: str):
    with urllib.request.urlopen(url) as response:
        return json.load(response)


def download_file(url: str, dest: pathlib.Path):
    with urllib.request.urlopen(url) as response, dest.open("wb") as fh:
        shutil.copyfileobj(response, fh)


def ensure_bootstrap_npm():
    npm_cli = NPM_HOME / "package/bin/npm-cli.js"
    if npm_cli.exists():
        return npm_cli

    meta = fetch_json("https://registry.npmjs.org/npm")
    version = meta["dist-tags"]["latest"]
    tarball_url = meta["versions"][version]["dist"]["tarball"]

    with tempfile.TemporaryDirectory() as tmpdir:
        archive = pathlib.Path(tmpdir) / "npm.tgz"
        download_file(tarball_url, archive)
        NPM_HOME.mkdir(parents=True, exist_ok=True)
        with tarfile.open(archive, "r:gz") as tf:
            tf.extractall(NPM_HOME)

    if not npm_cli.exists():
        raise RuntimeError("npm bootstrap failed")
    return npm_cli


def run(cmd, **kwargs):
    completed = subprocess.run(cmd, text=True, **kwargs)
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)
    return completed


def main():
    token = sys.stdin.readline().strip()
    if not token:
        raise SystemExit("Missing API token on stdin")

    print("Bootstrapping npm...", flush=True)
    npm_cli = ensure_bootstrap_npm()

    env = os.environ.copy()
    env["PATH"] = f"{NPM_PREFIX / 'bin'}:{env.get('PATH', '')}"

    install_cmd = [
        str(NODE_BIN),
        str(npm_cli),
        "install",
        "-g",
        "@anthropic-ai/claude-code",
        "--prefix",
        str(NPM_PREFIX),
    ]
    print("Installing Claude Code CLI...", flush=True)
    run(install_cmd, env=env, stdout=sys.stdout, stderr=sys.stderr)

    setup_cmd = [sys.executable, str(SETUP_SCRIPT)]
    print("Writing Claude and Antigravity settings...", flush=True)
    run(setup_cmd, input=token, env=env, stdout=sys.stdout, stderr=sys.stderr)

    claude_bin = NPM_PREFIX / "bin/claude"
    version = subprocess.run(
        [str(claude_bin), "--version"],
        text=True,
        capture_output=True,
        env=env,
    )
    if version.returncode == 0:
        print(json.dumps({"claudeInstalled": True, "claudeVersion": version.stdout.strip()}))
    else:
        print(json.dumps({"claudeInstalled": False, "versionCheckFailed": True}))


if __name__ == "__main__":
    main()
