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
        this.startMediaRotator();
        this.startDateTimeUpdater();
    }

    setupEventListeners() {
        // Real-time listeners
        db.settings.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.settings = snapshot.val();
                this.updateDisplay();
                this.updateMediaDisplay();
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
                this.updateMediaDisplay();
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
    updateMediaDisplay() {
        const mediaContainer = document.getElementById('mediaContainer');
        if (!mediaContainer || !this.settings.mediaPath) return;

        const mediaPath = this.settings.mediaPath.endsWith('/') ? this.settings.mediaPath : this.settings.mediaPath + '/';
        const videoElement = mediaContainer.querySelector('video');
        
        if (!videoElement) return;

        // Reset video source to prevent issues
        videoElement.src = '';
        videoElement.load();

        if (this.settings.currentVideo && this.settings.currentVideo.trim() !== '') {
            // Play a single video specified in settings
            const videoUrl = mediaPath + this.settings.currentVideo;
            console.log('Playing single video:', videoUrl);
            videoElement.src = videoUrl;
            videoElement.load();
            videoElement.play().catch(e => console.error('Error playing video:', e));
            // Stop rotation if a single video is set
            videoElement.onended = null;
        } else {
            // Implement a simple rotator for 1.mp4, 2.mp4, 3.mp4 (based on project structure)
            const mediaFiles = ['1.mp4', '2.mp4', '3.mp4'];
            let currentMediaIndex = 0;

            const playNextMedia = () => {
                const nextFile = mediaFiles[currentMediaIndex];
                const videoUrl = mediaPath + nextFile;
                
                console.log('Playing rotating video:', videoUrl);
                videoElement.src = videoUrl;
                videoElement.load();
                videoElement.play().catch(e => console.error('Error playing video:', e));

                currentMediaIndex = (currentMediaIndex + 1) % mediaFiles.length;
            };

            videoElement.onended = playNextMedia;
            videoElement.onerror = () => {
                console.error('Media error, skipping to next.');
                playNextMedia();
            };

            // Start the rotation
            playNextMedia();
        }
    },

    startMediaRotator() {
        // This function will be called once in init()
        this.updateMediaDisplay();
        // The media display logic is now self-contained with the video 'onended' event
        // for continuous playback/rotation.
    },

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

    showVideo(videoFile) {
        const mediaDisplay = document.getElementById('mediaDisplay');
        if (mediaDisplay) {
            const videoPath = this.settings.mediaPath || '/media/';
            mediaDisplay.innerHTML = `
                <video id="mainVideo" width="100%" height="100%" autoplay loop muted>
                    <source src="${videoPath}${videoFile}" type="video/mp4">
                    متصفحك لا يدعم عرض الفيديو.
                </video>
            `;
            // Ensure video starts playing
            const videoElement = document.getElementById('mainVideo');
            if (videoElement) {
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
            
            // Play suffix - create if not exists
            try {
                await this.playAudioFile(`${audioPath}suffix.mp3`);
            } catch (e) {
                // If suffix.mp3 doesn't exist, speak the suffix text
                this.speakText('شكراً لانتظاركم');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
        } catch (error) {
            console.error('Error playing audio sequence:', error);
            // Fallback to TTS
            this.speakCall(call);
        }
    }

    async playNumberSequence(number, audioPath) {
        // Max number is 9999, but the provided audio files only go up to 1000.
        // I will assume the max number is 1000 for safety, and handle up to 999.
        
        if (number > 1000) {
            // Fallback for numbers > 1000 if needed, but I will focus on the provided files.
            // For now, I will treat it as a single file if it exists, or fall back to TTS.
            try {
                await this.playAudioFile(`${audioPath}${number}.mp3`);
                return;
            } catch (e) {
                console.warn(`Audio file for number ${number} not found. Falling back to TTS.`);
                this.speakText(this.numberToArabic(number));
                await new Promise(resolve => setTimeout(resolve, 1000));
                return;
            }
        }

        if (number >= 100) {
            const hundreds = Math.floor(number / 100);
            const remainder = number % 100;
            
            // Play hundreds (e.g., 100, 200, 300)
            await this.playAudioFile(`${audioPath}${hundreds * 100}.mp3`);
            
            if (remainder > 0) {
                // Play "and" (و)
                await this.playAudioFile(`${audioPath}and.mp3`);
                number = remainder;
            } else {
                number = 0;
            }
        }
        
        if (number >= 20) {
            const tens = Math.floor(number / 10) * 10;
            const ones = number % 10;
            
            if (ones > 0) {
                // Play ones (e.g., 1, 2, 3)
                await this.playAudioFile(`${audioPath}${ones}.mp3`);
                // Play "and" (و)
                await this.playAudioFile(`${audioPath}and.mp3`);
            }
            
            // Play tens (e.g., 20, 30, 40)
            await this.playAudioFile(`${audioPath}${tens}.mp3`);
            
            number = 0;
        }
        
        if (number > 0) {
            // Numbers 1 to 19 are handled here (1-10, 11-19)
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
        this.startMediaRotator();
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
