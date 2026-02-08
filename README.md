# opikat-personal-experiments
personal projects

## Figma Console MCP

This project is configured with [figma-console-mcp](https://github.com/southleft/figma-console-mcp) for AI-assisted Figma design workflows.

### Setup

1. **Register a Figma app** at https://www.figma.com/developers/apps and note your `client_id`, `client_secret`, and `redirect_uri`.

2. **Complete the OAuth authorization flow** — direct the user to:
   ```
   https://www.figma.com/oauth?client_id=<CLIENT_ID>&redirect_uri=<REDIRECT_URI>&scope=files:read&state=<STATE>&response_type=code
   ```
   Figma will redirect back with a `code` parameter.

3. **Exchange the code for an access token:**
   ```bash
   export FIGMA_CLIENT_ID="your_client_id"
   export FIGMA_CLIENT_SECRET="your_client_secret"
   export FIGMA_REDIRECT_URI="your_redirect_uri"
   export FIGMA_AUTH_CODE="code_from_callback"

   ./scripts/get-figma-token.sh
   ```

4. **Set the token** for the MCP server:
   ```bash
   export FIGMA_ACCESS_TOKEN="<token from step 3>"
   ```

5. **Restart Claude Code** — the MCP server will start automatically via `.mcp.json`.

### For Figma for Government

Set `FIGMA_GOV=1` before running the script:
```bash
export FIGMA_GOV=1
./scripts/get-figma-token.sh
```
