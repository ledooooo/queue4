// Tickets Page JavaScript
class TicketsManager {
    constructor() {
        this.clinics = [];
        this.currentQueue = {};
        this.init();
    }

    init() {
        this.loadClinics();
        this.setupEventListeners();
        this.loadQueueStatus();
    }

    setupEventListeners() {
        // Real-time listeners
        db.clinics.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.clinics = Object.values(snapshot.val());
                this.updateClinicSelect();
                this.updateQueueStatus();
            }
        });

        db.current.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.currentQueue = snapshot.val();
                this.updateQueueStatus();
            }
        });

        // Form validation
        document.getElementById('startNumber')?.addEventListener('input', () => {
            this.validateNumbers();
        });

        document.getElementById('endNumber')?.addEventListener('input', () => {
            this.validateNumbers();
        });
    }

    loadClinics() {
        db.clinics.once('value', (snapshot) => {
            if (snapshot.exists()) {
                this.clinics = Object.values(snapshot.val());
                this.updateClinicSelect();
                this.updateQueueStatus();
            }
        });
    }

    loadQueueStatus() {
        db.current.once('value', (snapshot) => {
            if (snapshot.exists()) {
                this.currentQueue = snapshot.val();
                this.updateQueueStatus();
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

    validateNumbers() {
        const startInput = document.getElementById('startNumber');
        const endInput = document.getElementById('endNumber');
        
        if (!startInput || !endInput) return;

        const start = parseInt(startInput.value) || 0;
        const end = parseInt(endInput.value) || 0;

        if (start > end) {
            endInput.setCustomValidity('رقم النهاية يجب أن يكون أكبر من رقم البداية');
        } else if (end - start > 100) {
            endInput.setCustomValidity('لا يمكن طباعة أكثر من 100 تذكرة دفعة واحدة');
        } else {
            endInput.setCustomValidity('');
        }
    }

    generateTickets() {
        const clinicId = document.getElementById('clinicSelect').value;
        const startNumber = parseInt(document.getElementById('startNumber').value);
        const endNumber = parseInt(document.getElementById('endNumber').value);

        if (!clinicId) {
            this.showNotification('يرجى اختيار العيادة', 'error');
            return;
        }

        if (!startNumber || !endNumber || startNumber > endNumber) {
            this.showNotification('يرجى إدخال أرقام صحيحة', 'error');
            return;
        }

        if (endNumber - startNumber > 100) {
            this.showNotification('لا يمكن طباعة أكثر من 100 تذكرة دفعة واحدة', 'error');
            return;
        }

        const clinic = this.clinics.find(c => c.id === clinicId);
        if (!clinic) {
            this.showNotification('العيادة غير موجودة', 'error');
            return;
        }

        this.createTickets(clinic, startNumber, endNumber);
        this.showNotification(`تم إنشاء ${endNumber - startNumber + 1} تذكرة`, 'success');
    }

    createTickets(clinic, startNumber, endNumber) {
        const ticketGrid = document.getElementById('ticketGrid');
        const printSection = document.getElementById('printSection');
        
        if (!ticketGrid || !printSection) return;

        // Clear previous tickets
        ticketGrid.innerHTML = '';

        // Generate tickets
        for (let i = startNumber; i <= endNumber; i++) {
            const ticket = this.createTicket(clinic, i);
            ticketGrid.appendChild(ticket);
        }

        // Show print section
        printSection.classList.remove('hidden');
    }

    createTicket(clinic, number) {
        const ticket = document.createElement('div');
        ticket.className = 'ticket';

        const currentNumber = this.currentQueue[clinic.id] || 0;
        const waitingCount = Math.max(0, number - currentNumber);
        const waitTime = this.calculateWaitTime(waitingCount);

        ticket.innerHTML = `
            <div class="text-sm font-bold text-gray-800 mb-1">${clinic.name}</div>
            <div class="text-4xl font-bold text-blue-600 mb-2">${number}</div>
            <div class="text-xs text-gray-600 mb-1">العملاء السابقون: ${Math.max(0, currentNumber)}</div>
            <div class="text-xs text-gray-600 mb-1">الفاصل الزمني: ${waitTime}</div>
            <div class="text-xs text-gray-500">${new Date().toLocaleDateString('ar-SA')}</div>
        `;

        return ticket;
    }

    calculateWaitTime(waitingCount) {
        if (waitingCount === 0) return 'حالياً';
        
        const avgTimePerClient = 5; // 5 minutes per client
        const totalMinutes = waitingCount * avgTimePerClient;
        
        if (totalMinutes < 60) {
            return `${totalMinutes} دقيقة`;
        } else {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return minutes > 0 ? `${hours} ساعة و${minutes} دقيقة` : `${hours} ساعة`;
        }
    }

    printTickets() {
        const printSection = document.getElementById('printSection');
        if (!printSection || printSection.classList.contains('hidden')) {
            this.showNotification('يرجى إنشاء التذاكر أولاً', 'error');
            return;
        }

        // Configure print settings
        const printWindow = window.open('', '_blank');
        const printContent = `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>طباعة التذاكر</title>
                <style>
                    body { margin: 0; padding: 20px; font-family: 'Cairo', sans-serif; }
                    .ticket-grid { 
                        display: grid; 
                        grid-template-columns: repeat(4, 1fr); 
                        gap: 10px; 
                    }
                    .ticket {
                        width: 5cm;
                        height: 5cm;
                        border: 2px dashed #ccc;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        text-align: center;
                        background: white;
                        page-break-inside: avoid;
                        padding: 5px;
                        box-sizing: border-box;
                    }
                    @media print {
                        body { margin: 0; padding: 10px; }
                        .ticket { 
                            border: 1px solid #000; 
                            margin-bottom: 5px;
                        }
                    }
                </style>
            </head>
            <body>
                ${printSection.innerHTML}
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
        
        printWindow.onload = () => {
            printWindow.print();
            printWindow.close();
        };
    }

    resetForm() {
        document.getElementById('clinicSelect').value = '';
        document.getElementById('startNumber').value = '1';
        document.getElementById('endNumber').value = '20';
        
        const printSection = document.getElementById('printSection');
        if (printSection) {
            printSection.classList.add('hidden');
        }

        this.showNotification('تم تفريغ النموذج', 'info');
    }

    updateQueueStatus() {
        const container = document.getElementById('queueStatus');
        if (!container) return;

        container.innerHTML = '';

        this.clinics.forEach(clinic => {
            const currentNumber = this.currentQueue[clinic.id] || 0;
            const statusCard = this.createStatusCard(clinic, currentNumber);
            container.appendChild(statusCard);
        });
    }

    createStatusCard(clinic, currentNumber) {
        const card = document.createElement('div');
        card.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200 clinic-card';

        const lastCalled = currentNumber > 0 ? currentNumber : 'لا يوجد';
        const nextNumber = currentNumber + 1;

        card.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-lg font-semibold text-gray-800">${clinic.name}</h3>
                <span class="text-sm text-gray-500">رقم ${clinic.number}</span>
            </div>
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-gray-600">آخر رقم تم نداؤه:</span>
                    <span class="font-bold text-blue-600">${lastCalled}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">الرقم التالي:</span>
                    <span class="font-bold text-green-600">${nextNumber}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">عدد الانتظار:</span>
                    <span class="font-bold text-orange-600">${Math.max(0, nextNumber - currentNumber - 1)}</span>
                </div>
            </div>
        `;

        return card;
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
function generateTickets() {
    ticketsManager.generateTickets();
}

function printTickets() {
    ticketsManager.printTickets();
}

function resetForm() {
    ticketsManager.resetForm();
}

// Initialize tickets manager
let ticketsManager;
document.addEventListener('DOMContentLoaded', () => {
    ticketsManager = new TicketsManager();
});