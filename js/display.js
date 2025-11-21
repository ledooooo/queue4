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
                console.log('Clinics loaded:', this.clinics); // Debug log
                this.updateClinicsDisplay();
                this.updateCallDuration();
            } else {
                console.warn('No clinics data found in Firebase');
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
            } else {
                console.warn('No settings found');
            }
        });

        db.clinics.once('value', (snapshot) => {
            if (snapshot.exists()) {
                this.clinics = Object.values(snapshot.val());
                console.log('Initial clinics loaded:', this.clinics);
                this.updateClinicsDisplay();
            } else {
                console.error('No clinics found in database');
                // Show error message to user
                const container = document.getElementById('clinicsContainer');
                if (container) {
                    container.innerHTML = `
                        <div class="text-center text-gray-400 p-4">
                            <i class="fas fa-exclamation-triangle text-3xl mb-2"></i>
                            <p>لا توجد عيادات متاحة</p>
                            <p class="text-xs mt-2">يرجى إضافة العيادات من صفحة الإعدادات</p>
                        </div>
                    `;
                }
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
        if (!container) {
            console.error('Clinics container not found');
            return;
        }

        if (!this.clinics || this.clinics.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 p-4">
                    <i class="fas fa-clinic-medical text-3xl mb-2"></i>
                    <p>لا توجد عيادات</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        
        this.clinics.forEach(clinic => {
            const clinicCard = this.createClinicCard(clinic);
            container.appendChild(clinicCard);
        });
        
        console.log(`Displayed ${this.clinics.length} clinics`);
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
        // Ignore calls older than 5 seconds to prevent re-calling on refresh
        if (Date.now() - call.timestamp > 5000) {
            console.log('Ignoring old call:', call);
            return;
        }
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

	        // Play audio based on settings
	        if (!this.isMuted) {
	            if (this.settings.audioType === 'mp3') {
	                this.playAudioSequence(call);
	            } else {
	                // Default to TTS
	                this.speakCall(call);
	            }
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
	        
	        // Always use TTS when speakCall is explicitly called (which is when audioType is not 'mp3')
	        this.speakText(text);
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
	        // This function is now redundant as speakCall handles TTS fallback.
	        // The MP3 sequence logic is in playAudioSequence.
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
	
	    getFullPath(basePath, fileName) {
	        // Ensure basePath ends with a slash if it's not an absolute URL
	        if (!basePath.endsWith('/') && !basePath.match(/^https?:\/\//i)) {
	            basePath += '/';
	        }
	        // If basePath is an absolute URL, we assume it's correct.
	        // If it's a relative path, we ensure it has a leading slash if missing.
	        if (!basePath.startsWith('/') && !basePath.match(/^https?:\/\//i)) {
	            basePath = '/' + basePath;
	        }
	        
	        // Remove leading slash from fileName if it exists, to avoid double slashes
	        const cleanFileName = fileName.startsWith('/') ? fileName.substring(1) : fileName;
	        
	        return basePath + cleanFileName;
	    }

    handleDisplayUpdate(displayData) {
        // Clear media display on any new update
        this.clearMediaDisplay();

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
            case 'video':
                // Display video
                this.showVideo(displayData.content);
                break;
            case 'message':
                // Display message
                this.showMessage(displayData.content);
                break;
            case 'emergency':
                // Display emergency message
                this.showEmergency(displayData.content);
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
        const mediaDisplay = document.getElementById('mediaDisplay');
        if (mediaDisplay) {
            mediaDisplay.innerHTML = `<h2 class="text-6xl font-bold text-white">${name}</h2>`;
        }
    }

	    playCustomAudio(audioFile) {
	        if (!this.isMuted) {
	            const fullAudioUrl = this.getFullPath(this.settings.audioPath || '/audio/', audioFile);
	            const audio = new Audio(fullAudioUrl);
	            audio.play().catch(e => console.log('Could not play custom audio:', e));
	        }
	    }

	    playAudioMessage(audioFile) {
	        if (!this.isMuted) {
	            const fullAudioUrl = this.getFullPath(this.settings.audioPath || '/audio/', audioFile);
	            const audio = new Audio(fullAudioUrl);
	            audio.play().catch(e => console.log('Could not play audio message:', e));
	        }
	    }

	    showVideo(videoFile) {
	        const mediaDisplay = document.getElementById('mediaDisplay');
	        if (mediaDisplay) {
	            const videoPath = this.settings.mediaPath || '/media/';
	            const fullVideoUrl = this.getFullPath(videoPath, videoFile);
	            
	            mediaDisplay.innerHTML = `
	                <video id="mainVideo" width="100%" height="100%" autoplay loop muted playsinline>
	                    <source src="${fullVideoUrl}" type="video/mp4">
	                    متصفحك لا يدعم عرض الفيديو.
	                </video>
	            `;
	            // Ensure video starts playing
	            const videoElement = document.getElementById('mainVideo');
	            if (videoElement) {
	                // Autoplay often requires 'muted' and 'playsinline' attributes to work on mobile browsers.
	                // We also try to play it manually to cover all cases.
	                videoElement.play().catch(e => console.log('Video autoplay failed:', e));
	            }
	        }
	    }

    showMessage(message) {
        const mediaDisplay = document.getElementById('mediaDisplay');
        if (mediaDisplay) {
            mediaDisplay.innerHTML = `
                <div class="text-center p-8 bg-blue-900/50 rounded-xl">
                    <i class="fas fa-info-circle text-6xl text-blue-400 mb-4"></i>
                    <p class="text-4xl font-bold text-white">${message}</p>
                </div>
            `;
        }
    }

    showEmergency(message) {
        const mediaDisplay = document.getElementById('mediaDisplay');
        if (mediaDisplay) {
            mediaDisplay.innerHTML = `
                <div class="text-center p-8 bg-red-900/50 rounded-xl animate-pulse">
                    <i class="fas fa-exclamation-triangle text-8xl text-red-400 mb-4"></i>
                    <p class="text-5xl font-extrabold text-white">${message}</p>
                </div>
            `;
        }
    }

    clearMediaDisplay() {
        const mediaDisplay = document.getElementById('mediaDisplay');
        if (mediaDisplay) {
            mediaDisplay.innerHTML = `
                <i class="fas fa-play-circle text-6xl text-gray-400 mb-4"></i>
                <p class="text-gray-300">انتظر حتى يتم عرض المحتوى التوعوي</p>
            `;
        }
    }

    async playAudioSequence(call) {
        const clinic = this.clinics.find(c => c.id === call.clinicId);
        if (!clinic) return;

	        const audioPath = this.settings.audioPath || '/audio/';
	        const number = parseInt(call.number);
	        
	        try {
	            // Play ding sound
	            await this.playAudioFile(this.getFullPath(audioPath, 'ding.mp3'));
	            
	            // Play prefix - create if not exists
	            try {
	                await this.playAudioFile(this.getFullPath(audioPath, 'prefix.mp3'));
	            } catch (e) {
	                // If prefix.mp3 doesn't exist, speak the prefix text
	                this.speakText('على العميل رقم');
	                await new Promise(resolve => setTimeout(resolve, 1000));
	            }
	            
	            // Play number sequence
	            await this.playNumberSequence(number, audioPath);
	            
	            // Play clinic audio
	            await this.playAudioFile(this.getFullPath(audioPath, `clinic${clinic.number}.mp3`));
	            
	        } catch (error) {
	            console.error('Error playing audio sequence:', error);
	            // Fallback to TTS
	            this.speakCall(call);
	        }
	    }

	    async playNumberSequence(number, audioPath) {
	        if (number >= 100) {
	            const hundreds = Math.floor(number / 100) * 100;
	            await this.playAudioFile(this.getFullPath(audioPath, `${hundreds}.mp3`));
	            number %= 100;
	            if (number > 0) {
	                await this.playAudioFile(this.getFullPath(audioPath, 'and.mp3'));
	            }
	        }
	        
	        if (number >= 11 && number <= 19) {
	            // Numbers 11 to 19 are handled by their own files (e.g., 11.mp3)
	            await this.playAudioFile(this.getFullPath(audioPath, `${number}.mp3`));
	            number = 0; // Handled
	        } else if (number >= 20) {
	            const tens = Math.floor(number / 10) * 10;
	            await this.playAudioFile(this.getFullPath(audioPath, `${tens}.mp3`));
	            number %= 10;
	            if (number > 0) {
	                await this.playAudioFile(this.getFullPath(audioPath, 'and.mp3'));
	            }
	        }
	        
	        if (number > 0) {
	            // Numbers 1 to 10 are handled here
	            await this.playAudioFile(this.getFullPath(audioPath, `${number}.mp3`));
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
	            button.classList.remove('bg-gray-600', 'hover:bg-gray-700');
	            button.classList.add('bg-red-600', 'hover:bg-red-700');
	        } else {
	            icon.className = 'fas fa-volume-up';
	            button.classList.remove('bg-red-600', 'hover:bg-red-700');
	            button.classList.add('bg-gray-600', 'hover:bg-gray-700');
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
	                weekday: 'long',
	                day: 'numeric',
	                month: 'long',
	                year: 'numeric'
	            });
	            
	            const timeStr = now.toLocaleTimeString('ar-SA', {
	                hour: '2-digit',
	                minute: '2-digit',
	                hour12: true
	            });
	            
	            dateTimeElement.textContent = `${dateStr} - ${timeStr}`;
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
    displayManager.toggleMute();
}

// ⭐ الإضافة المهمة - Initialize display manager
const displayManager = new DisplayManager();

// Log initialization
console.log('Display Manager initialized successfully');
