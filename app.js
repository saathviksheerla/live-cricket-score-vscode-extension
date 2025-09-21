// app.js - Main application
const readline = require('readline');
const  CricketScraper  = require('./cricketScraper');
const  CricketService  = require('./cricketService');
const CricketServer  = require('./cricketServer');
const  CricketDisplay  = require('./cricketDisplay');

class CricketApp {
    constructor() {
        this.scraper = new CricketScraper();
        this.service = new CricketService(this.scraper);
        this.server = new CricketServer(this.service);
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.service.on('matchesUpdated', (matches) => {
            console.log(CricketDisplay.formatMatchList(matches));
        });

        this.service.on('matchSelected', (match) => {
            console.log(`Auto-refresh started for: ${match.title}`);
            console.log(CricketDisplay.formatMatchDetails(match));
        });

        this.service.on('matchUpdated', (match) => {
            console.clear();
            console.log(`[AUTO-REFRESH] Updated at: ${new Date().toLocaleTimeString()}`);
            console.log(CricketDisplay.formatMatchDetails(match));
            console.log('Commands: "c" to change match, "r" to change refresh rate, "s" to stop, "q" to quit');
        });

        this.service.on('error', (error) => {
            console.error(`Error: ${error.message}`);
        });
    }

    async start() {
        console.log('Cricket Score Server & CLI');
        console.log('==========================\n');

        // Start HTTP server
        this.server.start();
        console.log('');

        // Initialize and show matches
        const initialized = await this.service.initialize();
        if (!initialized) {
            console.log('Failed to initialize. Exiting...');
            return;
        }

        await this.startInteractiveMode();
    }

    async startInteractiveMode() {
        while (true) {
            const matches = this.service.getAllMatches();
            
            if (matches.length === 0) {
                console.log('No matches available.');
                break;
            }

            const answer = await this.askQuestion(`\nEnter match number (1-${matches.length}) to select, or 'q' to quit: `);

            if (answer.toLowerCase() === 'q') {
                console.log('Shutting down...');
                this.service.stopAutoRefresh();
                this.server.stop();
                break;
            }

            const matchNum = parseInt(answer);
            if (!isNaN(matchNum) && matchNum >= 1 && matchNum <= matches.length) {
                this.service.selectMatch(matchNum);
                await this.handleSelectedMatchMode();
            } else {
                console.log('Invalid input. Please try again.');
            }
        }
    }

    async handleSelectedMatchMode() {
        while (true) {
            const command = await this.askQuestion('');
            
            switch (command.toLowerCase()) {
                case 'c':
                    await this.changeMatch();
                    continue;
                case 'r':
                    await this.changeRefreshRate();
                    continue;
                case 's':
                    this.service.stopAutoRefresh();
                    console.log('Auto-refresh stopped.');
                    return;
                case 'q':
                    this.service.stopAutoRefresh();
                    this.server.stop();
                    console.log('Goodbye!');
                    process.exit(0);
                default:
                    console.log('Commands: "c" to change match, "r" to change refresh rate, "s" to stop, "q" to quit');
            }
        }
    }

    async changeMatch() {
        this.service.stopAutoRefresh();
        await this.service.initialize(); // Refresh matches list
        const matches = this.service.getAllMatches();
        
        console.log('\n' + CricketDisplay.formatMatchList(matches));
        
        const answer = await this.askQuestion(`Select new match (1-${matches.length}): `);
        const matchNum = parseInt(answer);
        
        if (!isNaN(matchNum) && matchNum >= 1 && matchNum <= matches.length) {
            this.service.selectMatch(matchNum);
        } else {
            console.log('Invalid selection. Continuing with current match...');
            this.service.startAutoRefresh();
        }
    }

    async changeRefreshRate() {
        const answer = await this.askQuestion('Enter refresh rate in seconds (minimum 5): ');
        const rate = parseInt(answer);
        
        if (!isNaN(rate) && rate >= 5) {
            this.service.setRefreshRate(rate);
            console.log(`Refresh rate changed to ${rate} seconds.`);
        } else {
            console.log('Invalid refresh rate. Keeping current rate.');
        }
    }

    askQuestion(question) {
        return new Promise(resolve => {
            this.rl.question(question, resolve);
        });
    }
}

// Start the application
if (require.main === module) {
    const app = new CricketApp();
    app.start().catch(console.error);
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down gracefully...');
        app.service.stopAutoRefresh();
        app.server.stop();
        app.rl.close();
        process.exit(0);
    });
}

module.exports = { CricketScraper, CricketService, CricketServer, CricketDisplay, CricketApp };