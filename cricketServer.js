// cricketServer.js - HTTP Server module
const http = require('http');
const url = require('url');

class CricketServer {
    constructor(cricketService, port = 3000) {
        this.service = cricketService;
        this.port = port;
        this.server = null;
    }

    start() {
        this.server = http.createServer((req, res) => {
            const parsedUrl = url.parse(req.url, true);
            const path = parsedUrl.pathname;
            const query = parsedUrl.query;

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');

            try {
                switch (path) {
                    case '/matches':
                        this.handleGetMatches(res);
                        break;
                    case '/select':
                        this.handleSelectMatch(res, query.id);
                        break;
                    case '/current':
                        this.handleGetCurrent(res);
                        break;
                    case '/change':
                        this.handleChangeMatch(res, query.id);
                        break;
                    case '/refresh-rate':
                        this.handleSetRefreshRate(res, query.seconds);
                        break;
                    default:
                        this.handleNotFound(res);
                }
            } catch (error) {
                this.handleError(res, error);
            }
        });

        this.server.listen(this.port, () => {
            console.log(`Cricket Score Server running on http://localhost:${this.port}`);
            console.log('Available endpoints:');
            console.log('  GET /matches - Get all matches');
            console.log('  GET /select?id=X - Select match for auto-refresh');
            console.log('  GET /current - Get current selected match details');
            console.log('  GET /change?id=X - Change selected match');
            console.log('  GET /refresh-rate?seconds=X - Set refresh rate');
        });
    }

    handleGetMatches(res) {
        const matches = this.service.getAllMatches();
        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            data: matches,
            count: matches.length
        }));
    }

    handleSelectMatch(res, matchId) {
        if (!matchId) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Match ID required' }));
            return;
        }

        const success = this.service.selectMatch(parseInt(matchId));
        if (success) {
            const match = this.service.getSelectedMatch();
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                message: 'Match selected for auto-refresh',
                data: match
            }));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, error: 'Match not found' }));
        }
    }

    handleGetCurrent(res) {
        const match = this.service.getSelectedMatch();
        if (match) {
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, data: match }));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, error: 'No match selected' }));
        }
    }

    handleChangeMatch(res, matchId) {
        if (!matchId) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Match ID required' }));
            return;
        }

        const success = this.service.changeMatch(parseInt(matchId));
        if (success) {
            const match = this.service.getSelectedMatch();
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                message: 'Match changed successfully',
                data: match
            }));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, error: 'Match not found' }));
        }
    }

    handleSetRefreshRate(res, seconds) {
        const rate = parseInt(seconds);
        if (isNaN(rate) || rate < 5) {
            res.writeHead(400);
            res.end(JSON.stringify({ 
                success: false, 
                error: 'Invalid refresh rate. Minimum 5 seconds.' 
            }));
            return;
        }

        this.service.setRefreshRate(rate);
        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            message: `Refresh rate set to ${rate} seconds`
        }));
    }

    handleNotFound(res) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
    }

    handleError(res, error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: error.message }));
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = CricketServer;