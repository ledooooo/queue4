// Display Page JavaScript
class DisplayManager {
    constructor() {
        this.settings = {};
        this.clinics = [];
        this.currentCalls = [];
        this.qrCode = null;
        this.isMuted = false;
        this.callDuration = 8000; // 8 seconds default
        this.lastProcessedCallId = null; // Track last call to avoid duplicates on refresh
        this.isInitialLoad = true; // Flag to prevent playing old calls
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
        this.initializeQRCode();
        this.updateDateTime();
        this.startDateTimeUpdater();
        
        // Mark initial load as complete after 2 seconds
        setTimeout(() => {
            this.isInitialLoad = false;
            console.log('Initial load complete - ready to play new calls');
        }, 2000);
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
                console.log('Clinics loaded:', this.clinics);
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

        // Listen for new calls ONLY (not existing ones)
        db.calls.on('child_added', (snapshot) => {
            const call = snapshot.val();
            const callId = snapshot.key;
            
            // Skip if this is during initial load
            if (this.isInitialLoad) {
                console.log('Skipping old call during initial load:', callId);
                this.lastProcessedCallId = callId; // Remember this call
                return;
            }
            
            // Skip if we already processed this call
            if (this.lastProcessedCallId === callId) {
                return;
            }
            
            console.log('New call received:', call);
            this.lastProcessedCallId = callId;
            this.handleNewCall(call);
            
            // Delete the call after processing (cleanup)
            setTimeout(() => {
                snapshot.ref.remove().then(() => {
                    console.log('Call cleaned up:', callId);
                }).catch(err => {
                    console.error('Error cleaning up call:', err);
                });
            }, this.callDuration + 1000); // Wait until call animation finishes
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

        // Get the last call ID to avoid replaying on refresh
        db.calls.limitToLast(1).once('value', (snapshot) => {
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    this.lastProcessedCallId = child.key;
                    console.log('Last processed call:', this.lastProcessedCallId);
                });
            }
        });
    }

    updateDisplay() {
        const centerNameElement = document.getElementById('centerName');
        if (centerNameElement && this.settings.centerName) {
            centerNameElement.textContent = this.settings.centerName;
        }

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
        console.log('Handling new call:', call, 'Muted:', this.isMuted);
        
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

        // Play audio only if not muted
        if (!this.isMuted) {
            if (this.settings.audioType === 'mp3') {
                this.playAudioSequence(call);
            } else {
                // Fallback to TTS
                this.speakCall(call);
            }
        } else {
            console.log('Audio muted - skipping playback');
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

            setTimeout(() => {
                notification.classList.add('hidden');
            }, this.callDuration);
        }
    }

    speakCall(call) {
        const clinic = this.clinics.find(c => c.id === call.clinicId);
        const clinicName = clinic ? clinic.name : 'العيادة';
        
        let text = `العميل رقم ${this.numberToArabic(call.number)} التوجه إلى ${clinicName}`;
        
        this.speakText(text);
    }

    speakText(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ar-SA';
            utterance.rate = this.settings.speechSpeed || 1;
            utterance.pitch = 1;
            
            const voices = speechSynthesis.getVoices();
            const arabicVoice = voices.find(voice => voice.lang.startsWith('ar'));
            if (arabicVoice) {
                utterance.voice = arabicVoice;
            }
            
            speechSynthesis.speak(utterance);
        }
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
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.log('Could not play ding sound:', e));
            }
        }
    }

    handleDisplayUpdate(displayData) {
        switch (displayData.type) {
            case 'client_name':
                this.showClientName(displayData.content);
                break;
            case 'custom_audio':
                this.playCustomAudio(displayData.content);
                break;
            case 'audio_message':
                this.playAudioMessage(displayData.content);
                break;
        }
    }

    updateCallDuration() {
        if (this.settings.callDuration) {
            this.callDuration = this.settings.callDuration;
        }
    }

    showClientName(name) {
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
        if (!clinic) {
            console.error('Clinic not found for call:', call);
            return;
        }

        const audioPath = this.settings.audioPath || 'audio/';
        // Ensure audioPath ends with /
        const basePath = audioPath.endsWith('/') ? audioPath : audioPath + '/';
        const number = parseInt(call.number);
        
        console.log('Starting audio sequence for number:', number, 'clinic:', clinic.name);
        
        try {
            // 1. Play ding sound
            await this.playAudioFile(`${basePath}ding.mp3`);
            await this.wait(300);
            
            // 2. Play prefix (على العميل رقم)
            await this.playAudioFile(`${basePath}prefix.mp3`);
            await this.wait(300);
            
            // 3. Play number sequence - FIXED ORDER: hundreds, and, ones, and, tens
            await this.playNumberSequenceMP3(number, basePath);
            await this.wait(300);
            
            // 4. Play clinic audio (التوجه إلى عيادة...)
            const clinicFile = `${basePath}clinic${clinic.number || clinic.id}.mp3`;
            console.log('Playing clinic file:', clinicFile);
            await this.playAudioFile(clinicFile);
            
            console.log('Audio sequence completed successfully');
            
        } catch (error) {
            console.error('Error in audio sequence:', error);
            // Fallback to TTS
            console.log('Falling back to TTS');
            this.speakCall(call);
        }
    }

    async playNumberSequenceMP3(number, basePath) {
        console.log('Playing number sequence for:', number);
        
        // Handle numbers 1-999
        let hundreds = 0;
        let tens = 0;
        let ones = 0;
        
        if (number >= 100) {
            hundreds = Math.floor(number / 100) * 100;
            number = number % 100;
        }
        
        if (number >= 20) {
            tens = Math.floor(number / 10) * 10;
            number = number % 10;
        }
        
        ones = number;
        
        // Play: hundreds + and + ones + and + tens
        // Example: 345 = 300 + and + 5 + and + 40
        
        if (hundreds > 0) {
            console.log('Playing hundreds:', hundreds);
            await this.playAudioFile(`${basePath}${hundreds}.mp3`);
            await this.wait(200);
            
            if (ones > 0 || tens > 0) {
                console.log('Playing "and" after hundreds');
                await this.playAudioFile(`${basePath}and.mp3`);
                await this.wait(200);
            }
        }
        
        if (ones > 0) {
            console.log('Playing ones:', ones);
            await this.playAudioFile(`${basePath}${ones}.mp3`);
            await this.wait(200);
            
            if (tens > 0) {
                console.log('Playing "and" between ones and tens');
                await this.playAudioFile(`${basePath}and.mp3`);
                await this.wait(200);
            }
        }
        
        if (tens > 0) {
            console.log('Playing tens:', tens);
            await this.playAudioFile(`${basePath}${tens}.mp3`);
            await this.wait(200);
        }
        
        // Special case: if number is exactly 20, 30, etc. (no ones)
        if (ones === 0 && tens > 0 && hundreds === 0) {
            console.log('Playing tens only:', tens);
            await this.playAudioFile(`${basePath}${tens}.mp3`);
            await this.wait(200);
        }
    }

    playAudioFile(src) {
        console.log('Attempting to play:', src);
        return new Promise((resolve, reject) => {
            const audio = new Audio(src);
            
            audio.onended = () => {
                console.log('Finished playing:', src);
                resolve();
            };
            
            audio.onerror = (e) => {
                console.error('Error loading audio:', src, e);
                reject(new Error(`Failed to load: ${src}`));
            };
            
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.error('Error playing audio:', src, err);
                    reject(err);
                });
            }
        });
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const button = document.getElementById('muteButton');
        if (!button) {
            console.error('Mute button not found');
            return;
        }
        
        const icon = button.querySelector('i');
        
        if (this.isMuted) {
            icon.className = 'fas fa-volume-mute';
            button.className = 'bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm';
            console.log('Audio muted');
        } else {
            icon.className = 'fas fa-volume-up';
            button.className = 'bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm';
            console.log('Audio unmuted');
        }
    }

    updateNewsTicker(newsData) {
        const ticker = document.getElementById('newsTicker');
        if (ticker) {
            const content = (newsData && newsData.content) ? newsData.content : 
                           (typeof newsData === 'string' ? newsData : 
                           'مرحباً بكم في المركز الطبي - نسعى لتقديم أفضل خدمة طبية لكم');
            
            ticker.textContent = content;
            
            ticker.style.animation = 'none';
            ticker.offsetHeight;
            ticker.style.animation = null;
        }
    }

    initializeQRCode() {
        const qrContainer = document.getElementById('qrcode');
        if (qrContainer && typeof QRCode !== 'undefined') {
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
        setInterval(() => {
            this.updateDateTime();
        }, 1000);
    }
}

// Global function for onclick handler
function toggleMute() {
    if (typeof displayManager !== 'undefined') {
        displayManager.toggleMute();
    } else {
        console.error('Display manager not initialized');
    }
}

// Initialize display manager
const displayManager = new DisplayManager();

console.log('Display Manager initialized successfully');
