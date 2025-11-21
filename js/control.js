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