// Control Page JavaScript
class ControlManager {
    constructor() {
        this.currentClinic = null;
        this.clinics = [];
        this.isLoggedIn = false;
        this.isMuted = false;
        this.init();
    }

    init() {
        this.loadClinics();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Real-time listeners
        db.clinics.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.clinics = Object.values(snapshot.val());
                this.updateClinicSelect();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.isLoggedIn) return;
            
            switch(e.key) {
                case 'ArrowUp':
                case ' ':
                    e.preventDefault();
                    this.nextClient();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.previousClient();
                    break;
                case 'r':
                case 'R':
                    e.preventDefault();
                    this.repeatCall();
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.logout();
                    break;
            }
        });

        // Handle modal inputs
        document.getElementById('passwordInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.login();
            }
        });
    }

    loadClinics() {
        db.clinics.once('value', (snapshot) => {
            if (snapshot.exists()) {
                this.clinics = Object.values(snapshot.val());
                this.updateClinicSelect();
            }
        });
    }

    updateClinicSelect() {
        const select = document.getElementById('clinicSelect');
        if (!select) return;

        select.innerHTML = '<option value="">-- اختر العيادة --</option>';
        
        this.clinics.forEach(clinic => {
            const option = document.createElement('option');
            option.value = clinic.id;
            option.textContent = `${clinic.name} (رقم ${clinic.number})`;
            select.appendChild(option);
        });
    }

    login() {
        const clinicId = document.getElementById('clinicSelect').value;
        const password = document.getElementById('passwordInput').value;

        if (!clinicId || !password) {
            this.showNotification('يرجى اختيار العيادة وإدخال كلمة المرور', 'error');
            return;
        }

        const clinic = this.clinics.find(c => c.id === clinicId);
        if (!clinic) {
            this.showNotification('العيادة غير موجودة', 'error');
            return;
        }

        if (clinic.password !== password) {
            this.showNotification('كلمة المرور غير صحيحة', 'error');
            return;
        }

        this.currentClinic = clinic;
        this.isLoggedIn = true;
        
        this.showControlPanel();
        this.updateCurrentDisplay();
        this.showNotification(`تم الدخول إلى ${clinic.name} بنجاح`, 'success');
    }

    logout() {
        this.currentClinic = null;
        this.isLoggedIn = false;
        
        this.showLoginPanel();
        this.showNotification('تم الخروج بنجاح', 'info');
    }

    showLoginPanel() {
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('controlSection').classList.add('hidden');
        document.getElementById('currentClinic').textContent = 'لم يتم اختيار عيادة';
        
        // Clear password field
        document.getElementById('passwordInput').value = '';
    }

    showControlPanel() {
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('controlSection').classList.remove('hidden');
        document.getElementById('currentClinic').textContent = this.currentClinic.name;
        
        // Update clinic info display
        document.getElementById('clinicName').textContent = this.currentClinic.name;
        this.updateCurrentNumber();
        
        // Add mute button
        const header = document.querySelector('header .container');
        if (header && !document.getElementById('controlMuteButton')) {
            const muteButton = document.createElement('button');
            muteButton.id = 'controlMuteButton';
            muteButton.onclick = () => this.toggleMute();
            muteButton.className = 'bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm ml-4';
            muteButton.innerHTML = '<i class="fas fa-volume-up"></i>';
            header.querySelector('.flex').appendChild(muteButton);
        }
    }

    updateCurrentDisplay() {
        if (!this.currentClinic) return;

        // Listen for current number updates
        db.current.child(this.currentClinic.id).on('value', (snapshot) => {
            this.updateCurrentNumber(snapshot.val() || 0);
        });
    }

    updateCurrentNumber(number = 0) {
        const currentElement = document.getElementById('currentNumber');
        if (currentElement) {
            currentElement.textContent = number;
            
            // Add animation effect
            currentElement.classList.add('animate-pulse');
            setTimeout(() => {
                currentElement.classList.remove('animate-pulse');
            }, 1000);
        }
    }

    nextClient() {
        if (!this.currentClinic) return;

        // Get current number and increment
        db.current.child(this.currentClinic.id).once('value', (snapshot) => {
            const currentNumber = snapshot.val() || 0;
            const newNumber = currentNumber + 1;

            // Update current number
            db.current.child(this.currentClinic.id).set(newNumber)
                .then(() => {
                    // Make call
                    this.makeCall(newNumber);
                    
                    // Update clinic data
                    this.updateClinicData(newNumber);
                    
                    this.showNotification(`تم الانتقال إلى العميل رقم ${newNumber}`, 'success');
                })
                .catch(error => {
                    console.error('Error updating current number:', error);
                    this.showNotification('فشل في التحديث', 'error');
                });
        });
    }

    previousClient() {
        if (!this.currentClinic) return;

        db.current.child(this.currentClinic.id).once('value', (snapshot) => {
            const currentNumber = snapshot.val() || 0;
            const newNumber = Math.max(0, currentNumber - 1);

            db.current.child(this.currentClinic.id).set(newNumber)
                .then(() => {
                    this.makeCall(newNumber);
                    this.updateClinicData(newNumber);
                    this.showNotification(`تم الرجوع إلى العميل رقم ${newNumber}`, 'success');
                })
                .catch(error => {
                    console.error('Error updating current number:', error);
                    this.showNotification('فشل في التحديث', 'error');
                });
        });
    }

    repeatCall() {
        if (!this.currentClinic) return;

        db.current.child(this.currentClinic.id).once('value', (snapshot) => {
            const currentNumber = snapshot.val() || 0;
            if (currentNumber > 0) {
                this.makeCall(currentNumber);
                this.showNotification(`تم تكرار النداء للعميل رقم ${currentNumber}`, 'success');
            } else {
                this.showNotification('لا يوجد عميل حالي للنداء', 'warning');
            }
        });
    }

    resetClinic() {
        if (!this.currentClinic) return;

        if (confirm('هل أنت متأكد من تصفير العيادة؟ سيتم إعادة العداد إلى الصفر.')) {
            db.current.child(this.currentClinic.id).set(0)
                .then(() => {
                    this.updateClinicData(0);
                    this.showNotification('تم تصفير العيادة بنجاح', 'success');
                })
                .catch(error => {
                    console.error('Error resetting clinic:', error);
                    this.showNotification('فشل في تصفير العيادة', 'error');
                });
        }
    }

    callSpecific() {
        document.getElementById('callModal').classList.remove('hidden');
        document.getElementById('callModal').classList.add('flex');
        document.getElementById('specificNumber').focus();
    }

    confirmCall() {
        const number = parseInt(document.getElementById('specificNumber').value);
        if (number && number > 0) {
            // Update current number
            db.current.child(this.currentClinic.id).set(number)
                .then(() => {
                    this.makeCall(number);
                    this.updateClinicData(number);
                    this.closeCallModal();
                    this.showNotification(`تم النداء على العميل رقم ${number}`, 'success');
                })
                .catch(error => {
                    console.error('Error updating current number:', error);
                    this.showNotification('فشل في التحديث', 'error');
                });
        } else {
            this.showNotification('يرجى إدخال رقم صحيح', 'error');
        }
    }

    closeCallModal() {
        document.getElementById('callModal').classList.add('hidden');
        document.getElementById('callModal').classList.remove('flex');
        document.getElementById('specificNumber').value = '';
    }

    displayMessage() {
        document.getElementById('messageModal').classList.remove('hidden');
        document.getElementById('messageModal').classList.add('flex');
        document.getElementById('messageText').focus();
    }

    confirmMessage() {
        const message = document.getElementById('messageText').value.trim();
        if (message) {
            db.display.set({
                type: 'message',
                content: message,
                timestamp: Date.now()
            });
            this.closeMessageModal();
            this.showNotification('تم عرض الرسالة', 'success');
        } else {
            this.showNotification('يرجى إدخال الرسالة', 'error');
        }
    }

    closeMessageModal() {
        document.getElementById('messageModal').classList.add('hidden');
        document.getElementById('messageModal').classList.remove('flex');
        document.getElementById('messageText').value = '';
    }

    makeCall(number) {
        if (!this.currentClinic) return;

        // Speak the call locally if not muted
        if (!this.isMuted) {
            this.speakLocalCall(number);
        }

        const callData = {
            number: number,
            clinicId: this.currentClinic.id,
            clinicName: this.currentClinic.name,
            timestamp: Date.now(),
            status: 'active'
        };

        db.calls.push(callData)
            .catch(error => {
                console.error('Error making call:', error);
            });
    }

    speakLocalCall(number) {
        const text = `العميل رقم ${number} التوجه إلى ${this.currentClinic.name}`;
        
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ar-SA';
            utterance.rate = 1;
            
            const voices = speechSynthesis.getVoices();
            const arabicVoice = voices.find(voice => voice.lang.startsWith('ar'));
            if (arabicVoice) {
                utterance.voice = arabicVoice;
            }
            
            speechSynthesis.speak(utterance);
        }
    }

    updateClinicData(currentNumber) {
        if (!this.currentClinic) return;

        const clinicRef = db.clinics.child(this.currentClinic.id);
        clinicRef.update({
            currentNumber: currentNumber,
            lastUpdate: Date.now()
        });
    }

    emergencyCall() {
        if (!this.currentClinic) return;

        const message = prompt('أدخل رسالة النداء الطارئ:');
        if (message) {
            db.display.set({
                type: 'emergency',
                content: message,
                timestamp: Date.now()
            });
            this.showNotification('تم إرسال النداء الطارئ', 'success');
        }
    }

    pauseClinic() {
        if (!this.currentClinic) return;

        const clinicRef = db.clinics.child(this.currentClinic.id);
        clinicRef.update({
            status: 'paused',
            lastUpdate: Date.now()
        });
        this.showNotification('تم إيقاف العيادة مؤقتاً', 'success');
    }

    resumeClinic() {
        if (!this.currentClinic) return;

        const clinicRef = db.clinics.child(this.currentClinic.id);
        clinicRef.update({
            status: 'active',
            lastUpdate: Date.now()
        });
        this.showNotification('تم استئناف عمل العيادة', 'success');
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const button = document.getElementById('controlMuteButton');
        const icon = button.querySelector('i');
        
        if (this.isMuted) {
            icon.className = 'fas fa-volume-mute';
            button.className = 'bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm ml-4';
        } else {
            icon.className = 'fas fa-volume-up';
            button.className = 'bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm ml-4';
        }
        
        this.showNotification(this.isMuted ? 'تم كتم الصوت' : 'تم تشغيل الصوت', 'info');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg text-white z-50 ${
            type === 'success' ? 'bg-green-600' : 
            type === 'error' ? 'bg-red-600' : 
            type === 'warning' ? 'bg-yellow-600' :
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
function login() {
    controlManager.login();
}

function logout() {
    controlManager.logout();
}

function nextClient() {
    controlManager.nextClient();
}

function previousClient() {
    controlManager.previousClient();
}

function repeatCall() {
    controlManager.repeatCall();
}

function resetClinic() {
    controlManager.resetClinic();
}

function callSpecific() {
    controlManager.callSpecific();
}

function confirmCall() {
    controlManager.confirmCall();
}

function closeCallModal() {
    controlManager.closeCallModal();
}

function displayMessage() {
    controlManager.displayMessage();
}

function confirmMessage() {
    controlManager.confirmMessage();
}

function closeMessageModal() {
    controlManager.closeMessageModal();
}

function emergencyCall() {
    controlManager.emergencyCall();
}

function pauseClinic() {
    controlManager.pauseClinic();
}

function resumeClinic() {
    controlManager.resumeClinic();
}

// Initialize control manager
let controlManager;
document.addEventListener('DOMContentLoaded', () => {
    controlManager = new ControlManager();
});