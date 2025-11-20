// Display Page JavaScript
class DisplayManager {
    constructor() {
        this.settings = {};
        this.clinics = [];
        this.currentCalls = [];
        this.qrCode = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
        this.initializeQRCode();
        this.updateDateTime();
        this.startDateTimeUpdater();
    }

    setupEventListeners() {
        // Real-time listeners
        db.settings.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.settings = snapshot.val();
                this.updateDisplay();
            }
        });

        db.clinics.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.clinics = Object.values(snapshot.val());
                this.updateClinicsDisplay();
            }
        });

        db.current.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.updateCurrentNumbers(snapshot.val());
            }
        });

        db.calls.on('child_added', (snapshot) => {
            const call = snapshot.val();
            this.handleNewCall(call);
        });

        db.display.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.handleDisplayUpdate(snapshot.val());
            }
        });

        db.news.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.updateNewsTicker(snapshot.val());
            }
        });
    }

    loadData() {
        // Load initial data
        db.settings.once('value', (snapshot) => {
            if (snapshot.exists()) {
                this.settings = snapshot.val();
                this.updateDisplay();
            }
        });

        db.clinics.once('value', (snapshot) => {
            if (snapshot.exists()) {
                this.clinics = Object.values(snapshot.val());
                this.updateClinicsDisplay();
            }
        });
    }

    updateDisplay() {
        // Update center name
        const centerNameElement = document.getElementById('centerName');
        if (centerNameElement && this.settings.centerName) {
            centerNameElement.textContent = this.settings.centerName;
        }

        // Update news ticker
        if (this.settings.newsTicker) {
            this.updateNewsTicker({ content: this.settings.newsTicker });
        }
    }

    updateClinicsDisplay() {
        const container = document.getElementById('clinicsContainer');
        if (!container) return;

        container.innerHTML = '';
        
        this.clinics.forEach(clinic => {
            const clinicCard = this.createClinicCard(clinic);
            container.appendChild(clinicCard);
        });
    }

    createClinicCard(clinic) {
        const card = document.createElement('div');
        card.className = 'clinic-card bg-gray-800 rounded-lg p-4 text-center border border-gray-700';
        card.id = `clinic-${clinic.id}`;
        
        card.innerHTML = `
            <h3 class="text-white font-bold text-lg mb-2">${clinic.name}</h3>
            <div class="text-3xl font-bold text-blue-400 mb-2" id="current-${clinic.id}">
                ${clinic.currentNumber || 0}
            </div>
            <div class="text-sm text-gray-400">
                <i class="fas fa-clock ml-1"></i>
                <span id="wait-time-${clinic.id}">غير محدد</span>
            </div>
        `;
        
        return card;
    }

    updateCurrentNumbers(currentData) {
        Object.keys(currentData).forEach(clinicId => {
            const currentElement = document.getElementById(`current-${clinicId}`);
            if (currentElement) {
                currentElement.textContent = currentData[clinicId] || 0;
            }
        });
    }

    handleNewCall(call) {
        // Play ding sound
        this.playDingSound();
        
        // Highlight clinic card
        const clinicCard = document.getElementById(`clinic-${call.clinicId}`);
        if (clinicCard) {
            clinicCard.classList.add('calling');
            setTimeout(() => {
                clinicCard.classList.remove('calling');
            }, 5000);
        }

        // Show call modal
        this.showCallModal(call);

        // Speak the call
        this.speakCall(call);
    }

    showCallModal(call) {
        const modal = document.getElementById('callModal');
        const message = document.getElementById('callMessage');
        const time = document.getElementById('callTime');

        if (modal && message && time) {
            const clinic = this.clinics.find(c => c.id === call.clinicId);
            const clinicName = clinic ? clinic.name : 'العيادة';
            
            message.textContent = `العميل رقم ${call.number} التوجه إلى ${clinicName}`;
            time.textContent = new Date().toLocaleTimeString('ar-SA');
            
            modal.classList.remove('hidden');
            modal.classList.add('flex');

            // Auto close after 5 seconds
            setTimeout(() => {
                this.closeCallModal();
            }, 5000);
        }
    }

    closeCallModal() {
        const modal = document.getElementById('callModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    speakCall(call) {
        const clinic = this.clinics.find(c => c.id === call.clinicId);
        const clinicName = clinic ? clinic.name : 'العيادة';
        
        let text = `العميل رقم ${this.numberToArabic(call.number)} التوجه إلى ${clinicName}`;
        
        if (this.settings.audioType === 'tts') {
            this.speakText(text);
        } else {
            this.playAudioFiles(call.number, clinicName);
        }
    }

    speakText(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ar-SA';
            utterance.rate = this.settings.speechSpeed || 1;
            utterance.pitch = 1;
            
            // Try to use Arabic voice
            const voices = speechSynthesis.getVoices();
            const arabicVoice = voices.find(voice => voice.lang.startsWith('ar'));
            if (arabicVoice) {
                utterance.voice = arabicVoice;
            }
            
            speechSynthesis.speak(utterance);
        }
    }

    playAudioFiles(number, clinicName) {
        // This would play concatenated audio files
        // Implementation depends on available audio files
        console.log(`Playing audio for: ${number} - ${clinicName}`);
    }

    numberToArabic(num) {
        const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
                     'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
        
        const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
        
        const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

        if (num < 20) return ones[num];
        if (num < 100) {
            const t = Math.floor(num / 10);
            const o = num % 10;
            return o > 0 ? `${ones[o]} و${tens[t]}` : tens[t];
        }
        if (num < 1000) {
            const h = Math.floor(num / 100);
            const remainder = num % 100;
            const hundredText = h === 1 ? 'مائة' : h === 2 ? 'مئتان' : `${ones[h]}مائة`;
            return remainder > 0 ? `${hundredText} و${this.numberToArabic(remainder)}` : hundredText;
        }
        
        return num.toString();
    }

    playDingSound() {
        const audio = document.getElementById('dingSound');
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log('Could not play ding sound:', e));
        }
    }

    handleDisplayUpdate(displayData) {
        switch (displayData.type) {
            case 'client_name':
                // Display client name on screen
                this.showClientName(displayData.content);
                break;
            case 'custom_audio':
                // Play custom audio
                this.playCustomAudio(displayData.content);
                break;
        }
    }

    showClientName(name) {
        // Implementation to show client name on display
        console.log('Showing client name:', name);
    }

    playCustomAudio(audioFile) {
        const audio = new Audio(`${this.settings.audioPath || '/audio/'}${audioFile}`);
        audio.play().catch(e => console.log('Could not play custom audio:', e));
    }

    updateNewsTicker(newsData) {
        const ticker = document.getElementById('newsTicker');
        if (ticker && newsData.content) {
            ticker.textContent = newsData.content;
        }
    }

    initializeQRCode() {
        const qrContainer = document.getElementById('qrcode');
        if (qrContainer) {
            // Generate QR code for the display page URL
            const displayUrl = window.location.origin + window.location.pathname.replace('display.html', '');
            this.qrCode = new QRCode(qrContainer, {
                text: displayUrl,
                width: 80,
                height: 80,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }

    updateDateTime() {
        const now = new Date();
        
        // Update date
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            const dateStr = now.toLocaleDateString('ar-SA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            dateElement.textContent = dateStr;
        }

        // Update time
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            const timeStr = now.toLocaleTimeString('ar-SA', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            timeElement.textContent = timeStr;
        }
    }

    startDateTimeUpdater() {
        // Update time every second
        setInterval(() => {
            this.updateDateTime();
        }, 1000);
    }
}

// Global function for onclick handler
function closeCallModal() {
    displayManager.closeCallModal();
}

// Initialize display manager
let displayManager;
document.addEventListener('DOMContentLoaded', () => {
    displayManager = new DisplayManager();
});