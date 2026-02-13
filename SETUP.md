# Project Setup & Private Environment

This project uses a split-repository structure to keep sensitive configuration and agent workflows private.

## Quick Start (New Machine)

1.  **Clone this repository** (Main Project).

    ```bash
    git clone <main-repo-url> ming
    cd ming
    ```

2.  **Clone the Private Repository**
    Clone your private repository into a folder named `private` inside the project root.

    ```bash
    git clone https://github.com/michael2221807/ming_private.git private
    ```

    _(Note: Ensure you have access rights to the private repo)_

3.  **Restore Directory Links**
    Run the setup script **as Administrator** to link the agent configuration and docs.
    ```cmd
    private\setup_private_env.bat
    ```

## What This Does

The script creates Directory Junctions (symlinks) for:

- `.agent/` -> `private/.agent/`
- `.cursor/` -> `private/.cursor/`
- `docs/` -> `private/docs/`
- `testing_gamedata/` -> `private/testing_gamedata/`

Once complete, the Agentic Framework and documentation will be available to all tools.
