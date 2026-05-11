#!/usr/bin/env python3
import json
import os
import pathlib
import shutil
import sys
from datetime import datetime


BASE_URL = "https://api.minimax.io/anthropic"
MODEL_VALUE = "MiniMax-M2.7"
SELECTED_MODEL = "minimax-m2.7"
CLAUDE_WRAPPER = os.path.expanduser("~/.npm-global/bin/claude")


def load_json(path: pathlib.Path):
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return {}
    return json.loads(text)


def write_json(path: pathlib.Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def backup_if_exists(path: pathlib.Path, stamp: str):
    if not path.exists():
        return None
    backup = path.with_name(f"{path.name}.bak.{stamp}")
    shutil.copy2(path, backup)
    return str(backup)


def ensure_path_export(shell_file: pathlib.Path):
    line = 'export PATH="$HOME/.npm-global/bin:$PATH"'
    if shell_file.exists():
        existing = shell_file.read_text(encoding="utf-8")
        if line in existing:
            return False
    else:
        shell_file.parent.mkdir(parents=True, exist_ok=True)
    with shell_file.open("a", encoding="utf-8") as fh:
        if shell_file.stat().st_size > 0:
            fh.write("\n")
        fh.write(line + "\n")
    return True


def main():
    token = sys.stdin.readline().strip()
    if not token:
        raise SystemExit("Missing API token on stdin")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    claude_settings_path = pathlib.Path(os.path.expanduser("~/.claude/settings.json"))
    antigravity_settings_path = pathlib.Path(
        os.path.expanduser("~/Library/Application Support/Antigravity/User/settings.json")
    )

    backups = []
    for target in (claude_settings_path, antigravity_settings_path):
        backup = backup_if_exists(target, stamp)
        if backup:
            backups.append(backup)

    claude_settings = load_json(claude_settings_path)
    claude_env = dict(claude_settings.get("env") or {})
    claude_env.update(
        {
            "ANTHROPIC_BASE_URL": BASE_URL,
            "ANTHROPIC_AUTH_TOKEN": token,
            "API_TIMEOUT_MS": "3000000",
            "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
            "ANTHROPIC_MODEL": MODEL_VALUE,
            "ANTHROPIC_SMALL_FAST_MODEL": MODEL_VALUE,
            "ANTHROPIC_DEFAULT_SONNET_MODEL": MODEL_VALUE,
            "ANTHROPIC_DEFAULT_OPUS_MODEL": MODEL_VALUE,
            "ANTHROPIC_DEFAULT_HAIKU_MODEL": MODEL_VALUE,
        }
    )
    claude_settings["env"] = claude_env
    write_json(claude_settings_path, claude_settings)

    antigravity_settings = load_json(antigravity_settings_path)
    antigravity_settings["claudeCode.preferredLocation"] = "panel"
    antigravity_settings["claudeCode.selectedModel"] = SELECTED_MODEL
    antigravity_settings["claudeCode.claudeProcessWrapper"] = CLAUDE_WRAPPER
    antigravity_settings["claudeCode.useTerminal"] = True
    antigravity_settings["claudeCode.environmentVariables"] = [
        {"name": "ANTHROPIC_BASE_URL", "value": BASE_URL},
        {"name": "ANTHROPIC_AUTH_TOKEN", "value": token},
        {"name": "API_TIMEOUT_MS", "value": "3000000"},
        {"name": "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "value": "1"},
        {"name": "ANTHROPIC_MODEL", "value": MODEL_VALUE},
        {"name": "ANTHROPIC_SMALL_FAST_MODEL", "value": MODEL_VALUE},
        {"name": "ANTHROPIC_DEFAULT_SONNET_MODEL", "value": MODEL_VALUE},
        {"name": "ANTHROPIC_DEFAULT_OPUS_MODEL", "value": MODEL_VALUE},
        {"name": "ANTHROPIC_DEFAULT_HAIKU_MODEL", "value": MODEL_VALUE},
    ]
    write_json(antigravity_settings_path, antigravity_settings)

    path_updates = []
    for shell_name in (".zprofile", ".zshrc", ".bash_profile", ".bashrc"):
        shell_path = pathlib.Path(os.path.expanduser(f"~/{shell_name}"))
        if ensure_path_export(shell_path):
            path_updates.append(str(shell_path))

    summary = {
        "backups": backups,
        "pathUpdated": path_updates,
        "claudeSettings": str(claude_settings_path),
        "antigravitySettings": str(antigravity_settings_path),
        "hasToken": True,
        "baseUrl": BASE_URL,
        "model": MODEL_VALUE,
        "useTerminal": True,
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
