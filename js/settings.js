// Settings Page JavaScript
class SettingsManager {
    constructor() {
        this.clinics = [];
        this.audioFiles = [];
        this.settings = {
            centerName: 'المركز الطبي',
            speechSpeed: 1,
            audioType: 'tts',
            audioPath: '/audio/',
            mediaPath: '/media/',
            newsTicker: 'مرحباً بكم في المركز الطبي',
            callDuration: 8000,
            autoPlayInterval: 0 // 0 means no auto play
        };
        this.init();
    }

    init() {
        this.loadSettings();
        this.loadClinics();
        this.loadAudioFiles();
        this.setupEventListeners();
        this.updateUI();
    }

    loadAudioFiles() {
        // In a real application, this would fetch a list of audio files from the server.
        // For this static project, we will use a predefined list based on the audio folder content.
        this.audioFiles = [
            { name: 'رسالة هدوء', file: 'keepquite.mp3' },
            { name: 'رسالة نظافة', file: 'nazafa.mp3' },
            { name: 'صوت إعادة تعيين', file: 'reset.mp3' },
            { name: 'صوت النداء (بداية)', file: 'prefix.mp3' },
            { name: 'صوت النداء (نهاية)', file: 'suffix.mp3' },
            { name: 'صوت جرس', file: 'ding.mp3' },
            { name: 'صوت التوجه إلى', file: 'go_to.mp3' },
            // Add more files as needed, or dynamically load them if a server is available.
        ];
        this.updateAudioFilesSelect();
    }

    updateAudioFilesSelect() {
        const select = document.getElementById('audioFileSelect');
        if (!select) return;

        select.innerHTML = '<option value="">-- اختر ملف صوتي --</option>';
        
        this.audioFiles.forEach(audio => {
            const option = document.createElement('option');
            option.value = audio.file;
            option.textContent = audio.name;
            select.appendChild(option);
        });
    }

    playSelectedAudio() {
        const select = document.getElementById('audioFileSelect');
        const audioFile = select.value;

        if (!audioFile) {
            this.showNotification('يرجى اختيار ملف صوتي أولاً', 'error');
            return;
        }

        // Send command to display screen to play the audio file
        db.display.set({
            type: 'custom_audio',
            content: audioFile,
            timestamp: Date.now()
        });

        const audioName = this.audioFiles.find(a => a.file === audioFile)?.name || audioFile;
        this.showNotification(`تم إذاعة الملف الصوتي: ${audioName}`, 'success');
    }

    setupEventListeners() {
        // Save settings button
        document.getElementById('saveSettings')?.addEventListener('click', () => {
            this.saveSettings();
        });

        // Real-time listeners
        db.settings.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.settings = { ...this.settings, ...snapshot.val() };
                this.updateUI();
            }
        });

        db.clinics.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.clinics = Object.values(snapshot.val());
                this.updateClinicsList();
            }
        });
    }

    loadSettings() {
        db.settings.once('value', (snapshot) => {
            if (snapshot.exists()) {
                this.settings = { ...this.settings, ...snapshot.val() };
                this.updateUI();
            }
        });
    }

    loadClinics() {
        db.clinics.once('value', (snapshot) => {
            if (snapshot.exists()) {
                this.clinics = Object.values(snapshot.val());
                this.updateClinicsList();
            }
        });
    }

    updateUI() {
        // Update form fields
        document.getElementById('centerName').value = this.settings.centerName || '';
        document.getElementById('speechSpeed').value = this.settings.speechSpeed || 1;
        document.getElementById('audioPath').value = this.settings.audioPath || '/audio/';
        document.getElementById('mediaPath').value = this.settings.mediaPath || '/media/';
	        document.getElementById('newsTicker').value = this.settings.newsTicker || '';
	        document.getElementById('callDuration').value = this.settings.callDuration || 8;
	        document.getElementById('currentVideo').value = this.settings.currentVideo || '1.mp4';
        document.getElementById('autoPlayInterval').value = this.settings.autoPlayInterval || 0;
        
        // Update audio type radio buttons
        const audioTypeRadios = document.querySelectorAll('input[name="audioType"]');
        audioTypeRadios.forEach(radio => {
            radio.checked = radio.value === this.settings.audioType;
        });
    }

    updateClinicsList() {
        const container = document.getElementById('clinicsList');
        if (!container) return;

        container.innerHTML = '';
        
        this.clinics.forEach((clinic, index) => {
            const clinicCard = this.createClinicCard(clinic, index);
            container.appendChild(clinicCard);
        });
    }

    createClinicCard(clinic, index) {
        const card = document.createElement('div');
        card.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';
        
        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-semibold text-gray-800">${clinic.name}</h3>
                <div class="flex space-x-2">
                    <button onclick="settingsManager.editClinic(${index})" class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="settingsManager.deleteClinic(${index})" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-sm font-medium text-gray-600">رقم العيادة</label>
                    <span class="text-lg font-bold text-blue-600">${clinic.number}</span>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-600">كلمة المرور</label>
                    <span class="text-sm text-gray-500">${clinic.password ? '********' : 'غير محدد'}</span>
                </div>
            </div>
        `;
        
        return card;
    }

    addClinic() {
        const name = prompt('أدخل اسم العيادة:');
        if (!name) return;

        const number = prompt('أدخل رقم العيادة:');
        if (!number) return;

        const password = prompt('أدخل كلمة مرور العيادة:');
        if (!password) return;

        const newClinic = {
            id: Date.now().toString(),
            name: name,
            number: number,
            password: password,
            currentNumber: 0,
            status: 'active'
        };

        this.clinics.push(newClinic);
        this.saveClinics();
    }

    editClinic(index) {
        const clinic = this.clinics[index];
        if (!clinic) return;

        const name = prompt('أدخل اسم العيادة:', clinic.name);
        if (!name) return;

        const number = prompt('أدخل رقم العيادة:', clinic.number);
        if (!number) return;

        const password = prompt('أدخل كلمة مرور العيادة:', clinic.password);
        if (!password) return;

        this.clinics[index] = {
            ...clinic,
            name: name,
            number: number,
            password: password
        };

        this.saveClinics();
    }

    deleteClinic(index) {
        if (confirm('هل أنت متأكد من حذف هذه العيادة؟')) {
            this.clinics.splice(index, 1);
            this.saveClinics();
        }
    }

    saveClinics() {
        const clinicsObj = {};
        this.clinics.forEach(clinic => {
            clinicsObj[clinic.id] = clinic;
        });
        
        db.clinics.set(clinicsObj)
            .then(() => {
                this.showNotification('تم حفظ العيادات بنجاح', 'success');
            })
            .catch(error => {
                console.error('Error saving clinics:', error);
                this.showNotification('فشل في حفظ العيادات', 'error');
            });
    }

    saveSettings() {
        // Collect form data
        this.settings.centerName = document.getElementById('centerName').value;
        this.settings.speechSpeed = parseFloat(document.getElementById('speechSpeed').value);
        this.settings.audioPath = document.getElementById('audioPath').value;
        this.settings.mediaPath = document.getElementById('mediaPath').value;
        this.settings.newsTicker = document.getElementById('newsTicker').value;
	        this.settings.callDuration = parseInt(document.getElementById('callDuration').value) || 8000;
	        this.settings.autoPlayInterval = parseInt(document.getElementById('autoPlayInterval').value) || 0;
	        this.settings.currentVideo = document.getElementById('currentVideo').value;
        
        // Get selected audio type
        const selectedAudioType = document.querySelector('input[name="audioType"]:checked');
        if (selectedAudioType) {
            this.settings.audioType = selectedAudioType.value;
        }

        // Save to Firebase
        db.settings.set(this.settings)
            .then(() => {
                this.showNotification('تم حفظ الإعدادات بنجاح', 'success');
                this.updateAutoPlayInterval();
            })
            .catch(error => {
                console.error('Error saving settings:', error);
                this.showNotification('فشل في حفظ الإعدادات', 'error');
            });
    }

    updateAutoPlayInterval() {
        const interval = parseInt(document.getElementById('autoPlayInterval').value) || 0;
        if (interval > 0) {
            this.startAutoPlay();
        } else {
            if (this.autoPlayIntervalId) {
                clearInterval(this.autoPlayIntervalId);
                this.autoPlayIntervalId = null;
            }
        }
    }

    callSpecificClient() {
        const clientNumber = prompt('أدخل رقم العميل:');
        if (clientNumber) {
            const clinicId = prompt('أدخل رقم العيادة:');
            if (clinicId) {
                this.makeCall(clientNumber, clinicId);
            }
        }
    }

    displayClientName() {
        const clientName = prompt('أدخل اسم العميل:');
        if (clientName) {
            db.display.set({
                type: 'client_name',
                content: clientName,
                timestamp: Date.now()
            });
            this.showNotification('تم عرض اسم العميل', 'success');
        }
    }

    playCustomAudio() {
        const audioFile = prompt('أدخل اسم ملف الصوت:');
        if (audioFile) {
            db.display.set({
                type: 'custom_audio',
                content: audioFile,
                timestamp: Date.now()
            });
            this.showNotification('تم تشغيل الصوت المخصص', 'success');
        }
    }

    playAudioMessage() {
        const messages = [
            'على المرضى الالتزام بالدور والهدوء',
            'يرجى الانتظار حتى يتم النداء على رقمكم',
            'شكراً لتعاونكم مع إدارة المركز',
            'يرجى الحفاظ على النظافة والهدوء'
        ];
        
        const message = prompt('اختر الرسالة الصوتية:\n' + 
            messages.map((msg, i) => `${i + 1}. ${msg}`).join('\n') + 
            '\n\nأدخل رقم الرسالة (1-4) أو أدخل نص مخصص:');
        
        if (message) {
            const selectedMessage = messages[parseInt(message) - 1] || message;
            const fileName = `message_${selectedMessage.replace(/\s+/g, '_').substring(0, 20)}.mp3`;
            
            db.display.set({
                type: 'audio_message',
                content: fileName,
                text: selectedMessage,
                timestamp: Date.now()
            });
            
	        this.showNotification(`تم تشغيل الرسالة: ${selectedMessage}`, 'success');
	        }
	    }

    setVideo() {
        const videoFile = prompt('أدخل اسم ملف الفيديو (مثلاً: 1.mp4):');
        if (videoFile) {
            db.display.set({
                type: 'video',
                content: videoFile,
                timestamp: Date.now()
            });
            this.showNotification(`تم تعيين الفيديو: ${videoFile}`, 'success');
        }
    }

    makeCall(number, clinicId) {
        const callData = {
            number: number,
            clinicId: clinicId,
            timestamp: Date.now(),
            status: 'active'
        };

        db.calls.push(callData)
            .then(() => {
                this.showNotification(`تم النداء على العميل رقم ${number}`, 'success');
            })
            .catch(error => {
                console.error('Error making call:', error);
                this.showNotification('فشل في النداء', 'error');
            });
    }

    recordAudio() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    this.showNotification('تم بدء التسجيل... اضغط OK لإيقاف التسجيل', 'info');
                    
                    const mediaRecorder = new MediaRecorder(stream);
                    const chunks = [];
                    
                    mediaRecorder.ondataavailable = e => chunks.push(e.data);
                    mediaRecorder.onstop = () => {
                        const blob = new Blob(chunks, { type: 'audio/mp3' });
                        const url = URL.createObjectURL(blob);
                        
                        // Here you would typically upload to Firebase Storage
                        // For now, we'll just show a notification
                        this.showNotification('تم التسجيل بنجاح (يتطلب إعداد Firebase Storage للرفع)', 'success');
                    };
                    
                    mediaRecorder.start();
                    
                    // Stop recording after user clicks OK
                    setTimeout(() => {
                        if (confirm('إيقاف التسجيل؟')) {
                            mediaRecorder.stop();
                            stream.getTracks().forEach(track => track.stop());
                        }
                    }, 5000);
                })
                .catch(err => {
                    this.showNotification('لا يمكن الوصول إلى الميكروفون', 'error');
                });
        } else {
            this.showNotification('المتصفح لا يدعم تسجيل الصوت', 'error');
        }
    }

    // Audio Files Management
    addAudioFile() {
        const name = prompt('أدخل اسم الملف الصوتي:');
        if (!name) return;

        const fileName = prompt('أدخل اسم الملف مع الامتداد (مثلاً: message1.mp3):');
        if (!fileName) return;

        const interval = prompt('أدخل الفترة بين التكرار بالدقائق (0 = بدون تكرار):');
        if (interval === null) return;

        const newAudioFile = {
            id: Date.now().toString(),
            name: name,
            fileName: fileName,
            interval: parseInt(interval) || 0,
            lastPlayed: 0,
            active: true
        };

        this.audioFiles.push(newAudioFile);
        this.saveAudioFiles();
        this.updateAudioFilesList();
        this.updateAudioSelect();
    }

    removeAudioFile(index) {
        if (confirm('هل أنت متأكد من حذف هذا الملف الصوتي؟')) {
            this.audioFiles.splice(index, 1);
            this.saveAudioFiles();
            this.updateAudioFilesList();
            this.updateAudioSelect();
        }
    }

    toggleAudioFile(index) {
        this.audioFiles[index].active = !this.audioFiles[index].active;
        this.saveAudioFiles();
        this.updateAudioFilesList();
    }

    playAudioFileFromList(fileId) {
        const audioFile = this.audioFiles.find(f => f.id === fileId);
        if (audioFile && audioFile.active) {
            db.display.set({
                type: 'audio_message',
                content: audioFile.fileName,
                timestamp: Date.now()
            });
            
            // Update last played time
            audioFile.lastPlayed = Date.now();
            this.saveAudioFiles();
            
            this.showNotification(`تم تشغيل: ${audioFile.name}`, 'success');
        }
    }

    saveAudioFiles() {
        const audioFilesObj = {};
        this.audioFiles.forEach(file => {
            audioFilesObj[file.id] = file;
        });
        
        db.settings.child('audioFiles').set(audioFilesObj)
            .then(() => {
                this.showNotification('تم حفظ ملفات الصوت', 'success');
            })
            .catch(error => {
                console.error('Error saving audio files:', error);
                this.showNotification('فشل في حفظ ملفات الصوت', 'error');
            });
    }

    loadAudioFiles() {
        db.settings.child('audioFiles').once('value', (snapshot) => {
            if (snapshot.exists()) {
                this.audioFiles = Object.values(snapshot.val());
                this.updateAudioFilesList();
                this.updateAudioSelect();
                this.startAutoPlay();
            }
        });
    }

    updateAudioFilesList() {
        const container = document.getElementById('audioFilesList');
        if (!container) return;

        container.innerHTML = '';
        
        this.audioFiles.forEach((file, index) => {
            const fileCard = this.createAudioFileCard(file, index);
            container.appendChild(fileCard);
        });
    }

    createAudioFileCard(file, index) {
        const card = document.createElement('div');
        card.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';
        
        const statusClass = file.active ? 'text-green-600' : 'text-red-600';
        const statusText = file.active ? 'نشط' : 'معطل';
        
        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-semibold text-gray-800">${file.name}</h3>
                <div class="flex space-x-2">
                    <button onclick="settingsManager.toggleAudioFile(${index})" class="${statusClass} hover:opacity-80">
                        <i class="fas ${file.active ? 'fa-pause' : 'fa-play'}"></i>
                    </button>
                    <button onclick="settingsManager.playAudioFileFromList('${file.id}')" class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-play"></i>
                    </button>
                    <button onclick="settingsManager.removeAudioFile(${index})" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                    <label class="block text-sm font-medium text-gray-600">اسم الملف</label>
                    <span class="text-sm text-gray-800">${file.fileName}</span>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-600">الحالة</label>
                    <span class="text-sm ${statusClass}">${statusText}</span>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-600">التكرار (دقائق)</label>
                    <span class="text-sm text-gray-800">${file.interval || 'بدون تكرار'}</span>
                </div>
            </div>
        `;
        
        return card;
    }

    updateAudioSelect() {
        const select = document.getElementById('audioMessageSelect');
        if (!select) return;

        select.innerHTML = '<option value="">-- اختر ملف صوتي --</option>';
        
        this.audioFiles.filter(file => file.active).forEach(file => {
            const option = document.createElement('option');
            option.value = file.id;
            option.textContent = file.name;
            select.appendChild(option);
        });
    }

    playSelectedAudioMessage() {
        const select = document.getElementById('audioMessageSelect');
        if (select && select.value) {
            this.playAudioFileFromList(select.value);
        } else {
            this.showNotification('يرجى اختيار ملف صوتي', 'error');
        }
    }

    startAutoPlay() {
        // Stop existing auto play
        if (this.autoPlayIntervalId) {
            clearInterval(this.autoPlayIntervalId);
        }
        
        // Start new auto play (every minute)
        this.autoPlayIntervalId = setInterval(() => {
            this.checkAutoPlay();
        }, 60000); // Check every minute
    }

    checkAutoPlay() {
        const now = Date.now();
        
        this.audioFiles.forEach(file => {
            if (file.active && file.interval > 0) {
                const intervalMs = file.interval * 60000; // Convert minutes to milliseconds
                if (now - file.lastPlayed >= intervalMs) {
                    this.playAudioFileFromList(file.id);
                }
            }
        });
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg text-white z-50 ${
            type === 'success' ? 'bg-green-600' : 
            type === 'error' ? 'bg-red-600' : 
            'bg-blue-600'
        }`;
        notification.textContent = message;

        // Add to page
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Global functions for onclick handlers
function addClinic() {
    settingsManager.addClinic();
}

function saveSettings() {
    settingsManager.saveSettings();
}

function callSpecificClient() {
    settingsManager.callSpecificClient();
}

function displayClientName() {
    settingsManager.displayClientName();
}

function playCustomAudio() {
    settingsManager.playCustomAudio();
}

function playAudioMessage() {
    settingsManager.playAudioMessage();
}

function setVideo() {
    settingsManager.setVideo();
}

function recordAudio() {
    settingsManager.recordAudio();
}

function addAudioFile() {
    settingsManager.addAudioFile();
}

function playSelectedAudioMessage() {
    settingsManager.playSelectedAudioMessage();
}

// Initialize settings manager
let settingsManager;
document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
});