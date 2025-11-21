// Display Page JavaScript
class DisplayManager {
    constructor() {
        this.settings = {};
        this.clinics = [];
        this.currentCalls = [];
        this.qrCode = null;
        this.isMuted = false;
        this.callDuration = 8000; // 8 seconds default
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
                this.updateCallDuration();
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
        const isPaused = clinic.status === 'paused';
        const statusClass = isPaused ? 'opacity-60' : '';
        const statusText = isPaused ? ' (متوقفة)' : '';
        const statusIcon = isPaused ? 'fas fa-pause' : 'fas fa-clock';
        const cardBg = isPaused ? 'bg-gray-700' : 'bg-gray-800';
        
        const card = document.createElement('div');
        card.className = `clinic-card ${cardBg} rounded-lg p-2 text-center border border-gray-600 ${statusClass}`;
        card.id = `clinic-${clinic.id}`;
        
        const textColor = isPaused ? 'text-gray-400' : 'text-white';
        const numberColor = isPaused ? 'text-gray-500' : 'text-blue-400';
        
        card.innerHTML = `
            <h3 class="${textColor} font-bold text-base mb-1">${clinic.name}${statusText}</h3>
            <div class="text-2xl font-bold ${numberColor} mb-1" id="current-${clinic.id}">
                ${clinic.currentNumber || 0}
            </div>
            <div class="text-xs text-gray-400">
                <i class="${statusIcon} ml-1"></i>
                <span id="wait-time-${clinic.id}">${isPaused ? 'متوقفة' : 'غير محدد'}</span>
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
        // Play ding sound only if not muted
        if (!this.isMuted) {
            this.playDingSound();
        }
        
        // Highlight clinic card
        const clinicCard = document.getElementById(`clinic-${call.clinicId}`);
        if (clinicCard) {
            clinicCard.classList.add('calling');
            setTimeout(() => {
                clinicCard.classList.remove('calling');
            }, this.callDuration);
        }

        // Show call notification
        this.showCallNotification(call);

        // Play audio sequence if using MP3 files
        if (this.settings.audioType === 'mp3' && !this.isMuted) {
            this.playAudioSequence(call);
        } else if (!this.isMuted) {
            // Fallback to TTS
            this.speakCall(call);
        }
    }

    showCallNotification(call) {
        const notification = document.getElementById('callNotification');
        const message = document.getElementById('callMessage');
        const time = document.getElementById('callTime');

        if (notification && message && time) {
            const clinic = this.clinics.find(c => c.id === call.clinicId);
            const clinicName = clinic ? clinic.name : 'العيادة';
            
            message.textContent = `العميل رقم ${call.number} التوجه إلى ${clinicName}`;
            time.textContent = new Date().toLocaleTimeString('ar-SA');
            
            notification.classList.remove('hidden');

            // Auto close after configured duration
            setTimeout(() => {
                notification.classList.add('hidden');
            }, this.callDuration);
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
            case 'audio_message':
                // Play audio message
                this.playAudioMessage(displayData.content);
                break;
        }
    }

    updateCallDuration() {
        // Update call duration from settings
        if (this.settings.callDuration) {
            this.callDuration = this.settings.callDuration;
        }
    }

    showClientName(name) {
        // Implementation to show client name on display
        console.log('Showing client name:', name);
    }

    playCustomAudio(audioFile) {
        if (!this.isMuted) {
            const audio = new Audio(`${this.settings.audioPath || '/audio/'}${audioFile}`);
            audio.play().catch(e => console.log('Could not play custom audio:', e));
        }
    }

    playAudioMessage(audioFile) {
        if (!this.isMuted) {
            const audio = new Audio(`${this.settings.audioPath || '/audio/'}${audioFile}`);
            audio.play().catch(e => console.log('Could not play audio message:', e));
        }
    }

    async playAudioSequence(call) {
        const clinic = this.clinics.find(c => c.id === call.clinicId);
        if (!clinic) return;

        const audioPath = this.settings.audioPath || '/audio/';
        const number = parseInt(call.number);
        
        try {
            // Play ding sound
            await this.playAudioFile(`${audioPath}ding.mp3`);
            
            // Play prefix - create if not exists
            try {
                await this.playAudioFile(`${audioPath}prefix.mp3`);
            } catch (e) {
                // If prefix.mp3 doesn't exist, speak the prefix text
                this.speakText('على العميل رقم');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Play number sequence
            await this.playNumberSequence(number, audioPath);
            
            // Play clinic audio
            await this.playAudioFile(`${audioPath}clinic${clinic.number}.mp3`);
            
        } catch (error) {
            console.error('Error playing audio sequence:', error);
            // Fallback to TTS
            this.speakCall(call);
        }
    }

    async playNumberSequence(number, audioPath) {
        if (number >= 100) {
            const hundreds = Math.floor(number / 100) * 100;
            await this.playAudioFile(`${audioPath}${hundreds}.mp3`);
            number %= 100;
            if (number > 0) {
                await this.playAudioFile(`${audioPath}and.mp3`);
            }
        }
        
        if (number >= 20) {
            const tens = Math.floor(number / 10) * 10;
            await this.playAudioFile(`${audioPath}${tens}.mp3`);
            number %= 10;
            if (number > 0) {
                await this.playAudioFile(`${audioPath}and.mp3`);
            }
        }
        
        if (number > 0) {
            await this.playAudioFile(`${audioPath}${number}.mp3`);
        }
    }

    playAudioFile(src) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(src);
            audio.onended = resolve;
            audio.onerror = reject;
            audio.play().catch(reject);
        });
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const button = document.getElementById('muteButton');
        const icon = button.querySelector('i');
        
        if (this.isMuted) {
            icon.className = 'fas fa-volume-mute';
            button.className = 'bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm';
        } else {
            icon.className = 'fas fa-volume-up';
            button.className = 'bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm';
        }
    }

    updateNewsTicker(newsData) {
        const ticker = document.getElementById('newsTicker');
        if (ticker) {
            const content = (newsData && newsData.content) ? newsData.content : 
                           (typeof newsData === 'string' ? newsData : 
                           'مرحباً بكم في المركز الطبي - نسعى لتقديم أفضل خدمة طبية لكم');
            
            ticker.textContent = content;
            
            // Force animation restart
            ticker.style.animation = 'none';
            ticker.offsetHeight; // Trigger reflow
            ticker.style.animation = null;
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
        
        // Update combined date and time
        const dateTimeElement = document.getElementById('currentDateTime');
        if (dateTimeElement) {
            const dateStr = now.toLocaleDateString('ar-SA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            
            const timeStr = now.toLocaleTimeString('ar-SA', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            
            dateTimeElement.textContent = `${dateStr} ${timeStr}`;
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
function toggleMute() {
    displayManager.toggleMute()