# Live Cricket Score for VS Code

Get live cricket scores right in your VS Code editor! Stay updated with the latest cricket scores without leaving your development environment.

## Features

- **Status Bar Integration**: Always see the latest score in your VS Code status bar
- **Detailed Score View**: Open a detailed view of the current match
- **Match Selection**: Choose from a list of ongoing matches
- **Auto-refresh**: Keep scores updated automatically
- **Quick Access**: Access cricket scores with simple commands

![Screenshot of VS Code with Live Cricket Score extension]

## Requirements

- You need a RapidAPI key to access the Cricbuzz API
- Get your API key by signing up at [RapidAPI](https://rapidapi.com/cricbuzz.p.rapidapi.com/market/api/cricbuzz-cricket)

## Extension Settings

This extension contributes the following settings:

* `liveCricketScore.rapidApiKey`: Your RapidAPI key for accessing the cricket API
* `liveCricketScore.autoRefreshOnStartup`: Automatically start refreshing scores when VS Code starts
* `liveCricketScore.showInStatusBar`: Show cricket score in status bar
* `liveCricketScore.refreshInterval`: Interval in seconds to refresh cricket scores

## Commands

- `Cricket: Show Quick Score`: Display a quick score update in a notification
- `Cricket: Show Detailed Score`: Open a detailed view of the current match
- `Cricket: Select Match`: Choose which match to follow
- `Cricket: Start Auto Refresh`: Start automatically refreshing the score
- `Cricket: Stop Auto Refresh`: Stop automatically refreshing the score

## Getting Started

1. Install the extension
2. Get your RapidAPI key from [Cricbuzz API on RapidAPI](https://rapidapi.com/cricbuzz.p.rapidapi.com/market/api/cricbuzz-cricket)
3. Enter your API key in the extension settings
4. Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and type "Cricket" to see available commands
5. Select "Cricket: Select Match" to choose which match to follow
6. Enable "Cricket: Start Auto Refresh" to keep the score updated automatically

## Known Issues

- The extension requires an internet connection to fetch cricket scores
- The API has rate limits that may affect frequent refreshing

## Release Notes

### 0.1.0

Initial release of Live Cricket Score extension:
- Status bar integration
- Detailed match view
- Match selection functionality
- Auto-refresh capability

---

## Development

- Clone the repository
- Run `npm install` to install dependencies
- Press F5 to open a new VS Code window with your extension loaded
- Set breakpoints in your code for debugging
- Find output from your extension in the debug console

## Build and Package

```bash
npm install -g vsce
vsce package
```

This will create a `.vsix` file that can be installed in VS Code.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the [MIT License](LICENSE).

---

**Enjoy cricket while you code!**