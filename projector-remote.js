// XBJ Projector Remote Control Module
class XBJProjectorRemote {
    constructor() {
        this.discoveredProjectors = [];
        this.currentProjector = null;
        this.isConnected = false;
    }

    // Discover projectors on local network (works with mDNS, HTTP scanning, or broadcast)
    async discoverProjectors() {
        this.discoveredProjectors = [];
        const statusEl = document.getElementById("discovery-status");

        if (statusEl) statusEl.textContent = "Scanning network for XBJ projectors...";

        try {
            // Method 1: Try mDNS discovery if browser supports it
            if ('mdns' in navigator || 'bluetooth' in navigator) {
                await this.tryMDNSDiscovery();
            }

            // Method 2: HTTP scanning of common local IPs
            await this.tryHTTPDiscovery();

            // Method 3: Check for WebRTC local IP and scan that subnet
            await this.tryLocalSubnetDiscovery();
        } catch (error) {
            console.error("Error during discovery:", error);
            if (statusEl) statusEl.textContent = "Discovery completed with some errors. Check console.";
        }

        if (this.discoveredProjectors.length === 0) {
            if (statusEl) statusEl.textContent = "No projectors found. Ensure projector is on and on same WiFi.";
        } else {
            if (statusEl) statusEl.textContent = `Found ${this.discoveredProjectors.length} projector(s)`;
            this.updateProjectorList();
        }

        return this.discoveredProjectors;
    }

    async tryHTTPDiscovery() {
        // Common local IP ranges to scan
        const ranges = [
            { start: "192.168.1.1", end: "192.168.1.254" },
            { start: "192.168.0.1", end: "192.168.0.254" },
            { start: "10.0.0.1", end: "10.0.0.254" }
        ];

        const promises = [];

        for (let range of ranges) {
            const [base, lastOctet] = range.start.rsplit(".", 1);
            const endOctet = parseInt(range.end.split(".")[3]);

            // Scan every 10th IP to keep it fast
            for (let i = 1; i <= endOctet; i += 10) {
                const ip = `${base}.${i}`;
                promises.push(this.checkProjectorAtIP(ip));
            }
        }

        await Promise.allSettled(promises);
    }

    async checkProjectorAtIP(ip) {
        const ports = [8080, 8000, 80, 9000]; // Common projector ports

        for (let port of ports) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1000);

                const response = await fetch(`http://${ip}:${port}/`, {
                    method: 'GET',
                    signal: controller.signal,
                    mode: 'no-cors'
                });

                clearTimeout(timeoutId);

                // Try to get device info
                try {
                    const infoResponse = await fetch(`http://${ip}:${port}/api/device/info`, {
                        signal: controller.signal
                    });
                    if (infoResponse.ok) {
                        const info = await infoResponse.json();
                        if (info.brand === "XBJ" || info.model?.includes("XBJ")) {
                            this.discoveredProjectors.push({
                                ip,
                                port,
                                name: info.name || `XBJ Projector at ${ip}`,
                                model: info.model || "Unknown"
                            });
                        }
                    }
                } catch (e) {
                    // If no API, assume it might be a projector if we got a response
                    console.log(`Found device at ${ip}:${port}`);
                }
            } catch (error) {
                // Device not responding on this port, continue
            }
        }
    }

    async tryLocalSubnetDiscovery() {
        // Use WebRTC to get local IP, then scan that subnet
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel("");
            pc.createOffer().then(offer => pc.setLocalDescription(offer));

            pc.onicecandidate = (ice) => {
                if (!ice || !ice.candidate || !ice.candidate.candidate) {
                    pc.close();
                    resolve();
                    return;
                }

                const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
                const ipAddress = ipRegex.exec(ice.candidate.candidate)[1];

                if (ipAddress && !ipAddress.startsWith("127.")) {
                    this.scanSubnet(ipAddress);
                }
            };
        });
    }

    async scanSubnet(localIP) {
        const parts = localIP.split(".");
        const base = parts.slice(0, 3).join(".");

        const promises = [];
        for (let i = 1; i <= 254; i++) {
            const ip = `${base}.${i}`;
            promises.push(this.checkProjectorAtIP(ip));
        }

        await Promise.allSettled(promises);
    }

    // Connect to a specific projector
    async connectToProjector(ip, port = 8080) {
        this.currentProjector = { ip, port };
        this.isConnected = true;

        // Verify connection
        try {
            const response = await fetch(`http://${ip}:${port}/api/device/status`);
            if (response.ok) {
                const status = await response.json();
                this.updateConnectionStatus(true, status);
                return true;
            }
        } catch (error) {
            console.error("Failed to connect:", error);
            this.isConnected = false;
        }

        return false;
    }

    // Control commands
    async sendCommand(command, value = null) {
        if (!this.currentProjector || !this.isConnected) {
            console.error("Not connected to projector");
            return false;
        }

        const { ip, port } = this.currentProjector;

        try {
            const endpoint = value !== null
                ? `http://${ip}:${port}/api/control/${command}/${value}`
                : `http://${ip}:${port}/api/control/${command}`;

            const response = await fetch(endpoint, { method: 'POST' });
            return response.ok;
        } catch (error) {
            console.error(`Command ${command} failed:`, error);
            return false;
        }
    }

    // Common projector controls
    async powerOn() { return this.sendCommand("power", "on"); }
    async powerOff() { return this.sendCommand("power", "off"); }
    async volumeUp() { return this.sendCommand("volume", "up"); }
    async volumeDown() { return this.sendCommand("volume", "down"); }
    async brightnessUp() { return this.sendCommand("brightness", "up"); }
    async brightnessDown() { return this.sendCommand("brightness", "down"); }
    async mute() { return this.sendCommand("mute"); }
    async unmute() { return this.sendCommand("unmute"); }
    async inputNext() { return this.sendCommand("input", "next"); }
    async inputPrev() { return this.sendCommand("input", "prev"); }
    async menuToggle() { return this.sendCommand("menu", "toggle"); }
    async up() { return this.sendCommand("navigate", "up"); }
    async down() { return this.sendCommand("navigate", "down"); }
    async left() { return this.sendCommand("navigate", "left"); }
    async right() { return this.sendCommand("navigate", "right"); }
    async select() { return this.sendCommand("navigate", "select"); }
    async back() { return this.sendCommand("navigate", "back"); }
    async home() { return this.sendCommand("navigate", "home"); }
    async launchApp(appName) { return this.sendCommand("app", appName); }
    async focusPlus() { return this.sendCommand("focus", "plus"); }
    async focusMinus() { return this.sendCommand("focus", "minus"); }

    // UI Updates
    updateProjectorList() {
        const listEl = document.getElementById("projector-list");
        if (!listEl) return;

        listEl.innerHTML = this.discoveredProjectors.map(proj => `
            <div class="projector-item">
                <div class="projector-info">
                    <div class="projector-name">${proj.name}</div>
                    <div class="projector-details">${proj.model} @ ${proj.ip}:${proj.port}</div>
                </div>
                <button class="btn-connect" data-ip="${proj.ip}" data-port="${proj.port}">
                    Connect
                </button>
            </div>
        `).join("");

        // Add click handlers
        listEl.querySelectorAll(".btn-connect").forEach(btn => {
            btn.addEventListener("click", async () => {
                const ip = btn.dataset.ip;
                const port = btn.dataset.port;
                await this.connectToProjector(ip, port);
            });
        });
    }

    updateConnectionStatus(connected, status = null) {
        const statusEl = document.getElementById("connection-status");
        if (!statusEl) return;

        if (connected && this.currentProjector) {
            statusEl.innerHTML = `
                <div class="status-connected">
                    <span class="status-indicator"></span>
                    Connected to ${this.currentProjector.ip}
                    ${status ? `<div class="projector-status">${JSON.stringify(status)}</div>` : ""}
                </div>
            `;
            statusEl.classList.add("connected");
        } else {
            statusEl.innerHTML = '<div class="status-disconnected">Not connected</div>';
            statusEl.classList.remove("connected");
        }
    }
}

// Initialize global instance
window.projectorRemote = new XBJProjectorRemote();
