class SchoolAttendanceApp {

    initPWA() {
        // Détection mobile plus robuste
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                        (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
        
        if (!isMobile) {
            console.log('PWA: Desktop détecté, pas de bouton d\'installation');
            return;
        }

        // Service worker...
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then((registration) => {
                        console.log('SW enregistré:', registration.scope);
                    })
                    .catch((error) => {
                        console.log('Échec SW:', error);
                    });
            });
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA: beforeinstallprompt détecté sur mobile');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        // Force l'affichage du bouton après un délai sur mobile si PWA possible
        setTimeout(() => {
            if (this.deferredPrompt || this.isPWAInstallable()) {
                this.showInstallButton();
            }
        }, 3000);
    }

    isPWAInstallable() {
        // Vérifications supplémentaires pour PWA
        return 'serviceWorker' in navigator && 
            window.matchMedia('(display-mode: browser)').matches &&
            !window.matchMedia('(display-mode: standalone)').matches;
    }

    showInstallButton() {
        if (!document.getElementById('installBtn')) {
            const installBtn = document.createElement('button');
            installBtn.id = 'installBtn';
            installBtn.className = 'btn btn--primary install-btn show';
            installBtn.innerHTML = '📱 Installer l\'app';
            installBtn.addEventListener('click', this.promptInstall.bind(this));
            document.body.appendChild(installBtn);
            console.log('Bouton PWA affiché');
        }
    }

    promptInstall() {
        console.log('Prompt d\'installation PWA');
        console.log('deferredPrompt disponible:', !!this.deferredPrompt); // Debug
        
        if (this.deferredPrompt) { // Utiliser this.deferredPrompt au lieu de window.deferredPrompt
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice.then((choiceResult) => {
                console.log('Choix utilisateur:', choiceResult.outcome);
                if (choiceResult.outcome === 'accepted') {
                    console.log('Installation acceptée');
                }
                this.deferredPrompt = null; // Nettoyer après utilisation
            });
        } else {
            console.log('deferredPrompt non disponible - PWA peut-être déjà installée');
            this.showNotification('L\'application est peut-être déjà installée', 'info');
        }
    }



    constructor() {
        this.data = {
            children: [],
            attendance: {}
        };
        this.deferredPrompt = null;
        this.pwaAvailable = false; 
        
        // Tarifs from the provided data
        this.tariffs = {
            "lundi-mardi-jeudi-vendredi": {
                "Arrivée": {
                    "07:30-08:10": { "type": "Accueil payant", "tarif": 0.60 },
                    "08:10-08:25": { "type": "Accueil gratuit", "tarif": 0.00 }
                },
                "Midi": {
                    "12:05-13:30": { "type": "Temps de midi", "tarif": 2.70 },
                    "repas_chaud": { "desc": "Repas chaud & dessert", "tarif": 3.57 }
                },
                "Retour": {
                    "15:25-16:00": { "type": "Accueil gratuit", "tarif": 0.00 },
                    "16:00-17:15": { "type": "Accueil payant", "tarif": 3.10 },
                    "17:15-18:00": { "type": "Accueil payant", "tarif": 4.10 }
                }
            },
            "mercredi": {
                "Arrivée": {
                    "07:30-08:10": { "type": "Accueil payant", "tarif": 0.60 },
                    "08:10-08:25": { "type": "Accueil gratuit", "tarif": 0.00 }
                },
                "Retour": {
                    "12:05-12:20": { "type": "Accueil gratuit", "tarif": 0.00 },
                    "12:20-14:00": { "type": "Accueil payant (temps de midi inclus)", "tarif": 2.70 },
                    "14:00-16:00": { "type": "Accueil payant (temps de midi inclus)", "tarif": 5.20 },
                    "16:00-18:30": { "type": "Accueil payant (temps de midi inclus)", "tarif": 7.70 }
                }
            }
        };
        
        this.currentChild = null;
        this.currentDate = this.formatDate(new Date());
        this.currentTab = 'dashboard';
        this.pendingAction = null;
        this.currentDetailDate = null;
        
        // School year limits
        this.schoolYearStart = new Date('2025-08-01');
        this.schoolYearEnd = new Date('2026-07-31');
        
        this.supabaseSync = null;

        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.initializeDateSelector();
        this.updateCurrentDate();
        this.renderAttendance();
        this.renderDashboard();
        this.renderChildren();
        this.renderHistory();
        this.initPWA();
        this.supabaseSync = new SupabaseSync(this);
    }

    setupEventListeners() {
        // Tab navigation
        document.addEventListener('click', (e) => {
            const navTab = e.target.closest('.nav-tab');
            if (navTab && navTab.dataset.tab) {
                e.preventDefault();
                this.switchTab(navTab.dataset.tab);
            }
        });

        // Date selector
        const attendanceDateEl = document.getElementById('attendanceDate');
        if (attendanceDateEl) {
            attendanceDateEl.addEventListener('change', (e) => {
                this.currentDate = e.target.value;
                this.renderAttendance();
                this.updateDailySummary();
            });
        }

        // Child selection
        const childSelectEl = document.getElementById('childSelect');
        if (childSelectEl) {
            childSelectEl.addEventListener('change', (e) => {
                this.currentChild = e.target.value;
                this.renderAttendanceOptions();
                this.updateDailySummary();
            });
        }

        // Add child form
        const addChildForm = document.getElementById('addChildForm');
        if (addChildForm) {
            addChildForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addChild();
            });
        }

        // History controls
        const monthSelect = document.getElementById('monthSelect');
        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                this.renderCalendar(e.target.value);
                this.updateMonthlySummary(e.target.value);
            });
        }

        const invoiceAmount = document.getElementById('invoiceAmount');
        if (invoiceAmount) {
            invoiceAmount.addEventListener('input', () => {
                this.updateDifference();
            });
        }

        // Export and reset buttons
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        const resetDataBtn = document.getElementById('resetDataBtn');
        if (resetDataBtn) {
            resetDataBtn.addEventListener('click', () => {
                this.confirmAction('Réinitialiser toutes les données', 
                    'Cette action supprimera définitivement tous les enfants et l\'historique des présences.',
                    () => this.resetAllData()
                );
            });
        }

        // Modal events
        const confirmCancel = document.getElementById('confirmCancel');
        if (confirmCancel) {
            confirmCancel.addEventListener('click', () => this.hideModal());
        }

        const confirmOk = document.getElementById('confirmOk');
        if (confirmOk) {
            confirmOk.addEventListener('click', () => {
                if (this.pendingAction) {
                    this.pendingAction();
                    this.pendingAction = null;
                }
                this.hideModal();
            });
        }

        // Dans la méthode setupEventListeners(), ajoutez :

        // Day details modal
        const closeDayDetailsBtn = document.getElementById('closeDayDetailsBtn');
        if (closeDayDetailsBtn) {
            closeDayDetailsBtn.addEventListener('click', () => this.hideDayDetailsModal());
        }

        const deleteDayBtn = document.getElementById('deleteDayBtn');
        if (deleteDayBtn) {
            deleteDayBtn.addEventListener('click', () => this.deleteDayData());
        }

        // Modal close buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-close')) {
                this.hideDayDetailsModal();
            }
            if (e.target === document.getElementById('dayDetailsModal')) {
                this.hideDayDetailsModal();
            }
        });

    }

    loadData() {
        try {
            const savedData = localStorage.getItem('ndg-attendance-data');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                this.data = {
                    children: parsedData.children || [],
                    attendance: parsedData.attendance || {}
                };
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Erreur lors du chargement des données', 'error');
        }
    }

    saveData() {
        try {
            localStorage.setItem('ndg-attendance-data', JSON.stringify(this.data));
            // Sauvegarde automatique vers Supabase si configuré
            if (this.supabaseSync && this.supabaseSync.isConfigured()) {
                // Sauvegarde différée pour éviter trop d'appels
                clearTimeout(this.autoBackupTimeout);
                this.autoBackupTimeout = setTimeout(() => {
                    this.supabaseSync.backup().catch(console.error);
                }, 5000); // 5 secondes après la dernière modification
            }
        } catch (error) {
            console.error('Error saving data:', error);
            this.showNotification('Erreur lors de la sauvegarde', 'error');
        }
    }

    initializeDateSelector() {
        const attendanceDateEl = document.getElementById('attendanceDate');
        if (!attendanceDateEl) return;
        
        // Set min and max dates for school year
        attendanceDateEl.min = this.formatDate(this.schoolYearStart);
        attendanceDateEl.max = this.formatDate(this.schoolYearEnd);
        
        // Set default date
        const today = new Date();
        if (today >= this.schoolYearStart && today <= this.schoolYearEnd) {
            attendanceDateEl.value = this.formatDate(today);
            this.currentDate = this.formatDate(today);
        } else {
            attendanceDateEl.value = this.formatDate(this.schoolYearStart);
            this.currentDate = this.formatDate(this.schoolYearStart);
        }
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const activeContent = document.getElementById(tabName);
        if (activeContent) {
            activeContent.classList.add('active');
        }

        this.currentTab = tabName;

        // Refresh content based on tab
        switch(tabName) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'attendance':
                this.renderAttendance();
                break;
            case 'children':
                this.renderChildren();
                break;
            case 'history':
                this.renderHistory();
                break;
        }
    }

    updateCurrentDate() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const currentDateEl = document.querySelector('.current-date');
        if (currentDateEl) {
            currentDateEl.textContent = now.toLocaleDateString('fr-FR', options);
        }
    }

    renderAttendance() {
        this.updateChildSelect();
        this.updateDayInfo();
        this.renderAttendanceOptions();
        this.updateDailySummary();
    }

    updateChildSelect() {
        const selectEl = document.getElementById('childSelect');
        if (!selectEl) return;
        
        // Clear existing options
        selectEl.innerHTML = '<option value="">-- Choisir un enfant --</option>';
        
        // Add children options
        this.data.children.forEach(child => {
            const option = document.createElement('option');
            option.value = child.id;
            option.textContent = child.name;
            if (child.id === this.currentChild) {
                option.selected = true;
            }
            selectEl.appendChild(option);
        });
    }

    updateDayInfo() {
        const dayInfoEl = document.getElementById('currentDayInfo');
        if (!dayInfoEl) return;
        
        const date = new Date(this.currentDate);
        const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
        const dayType = this.getDayType(date);
        
        dayInfoEl.textContent = `${dayName} - ${dayType === 'mercredi' ? 'Mercredi' : 'Jour normal'}`;
    }

    renderAttendanceOptions() {
        const containerEl = document.getElementById('attendanceGrid');
        if (!containerEl) return;
        
        if (!this.currentChild) {
            containerEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👶</div>
                    <p>Sélectionnez un enfant pour enregistrer ses présences.</p>
                </div>
            `;
            return;
        }

        const date = new Date(this.currentDate);
        const dayType = this.getDayType(date);
        const tariffs = this.tariffs[dayType];
        const childAttendance = this.getChildAttendance(this.currentChild, this.currentDate);

        let optionsHTML = '';

        // Render each group
        Object.entries(tariffs).forEach(([groupName, options]) => {
            optionsHTML += this.renderAttendanceGroup(groupName, options, childAttendance, dayType);
        });

        containerEl.innerHTML = optionsHTML;
    }

    renderAttendanceGroup(groupName, options, childAttendance, dayType) {
        const isExclusive = groupName === 'Arrivée' || groupName === 'Retour';
        const groupSubtitle = isExclusive ? '(Un seul choix)' : 
                             groupName === 'Midi' ? '(Choix multiples possibles)' : '';

        let tilesHTML = '';

        Object.entries(options).forEach(([key, option]) => {
            const isSelected = childAttendance && childAttendance[key];
            const costLevel = this.getCostLevel(option.tarif);
            const timeDisplay = key === 'repas_chaud' ? 'Repas chaud' : key;
            const description = key === 'repas_chaud' ? option.desc : option.type;

            tilesHTML += `
                <div class="attendance-tile ${costLevel} ${isSelected ? 'selected' : ''}" 
                     onclick="app.selectAttendanceOption('${groupName}', '${key}', ${option.tarif}, '${description.replace(/'/g, "\\'")}', ${isExclusive})">
                    <div class="tile-time">${timeDisplay}</div>
                    <div class="tile-description">${description}</div>
                    <div class="tile-cost ${costLevel}">
                        ${option.tarif === 0 ? 'Gratuit' : option.tarif.toFixed(2) + ' €'}
                    </div>
                </div>
            `;
        });

        return `
            <div class="attendance-group">
                <div class="group-header">
                    <div>
                        <h3 class="group-title">${groupName}</h3>
                        ${groupSubtitle ? `<p class="group-subtitle">${groupSubtitle}</p>` : ''}
                    </div>
                </div>
                <div class="attendance-options">
                    ${tilesHTML}
                </div>
            </div>
        `;
    }

    selectAttendanceOption(groupName, optionKey, cost, description, isExclusive) {
        if (!this.currentChild) return;

        if (!this.data.attendance[this.currentDate]) {
            this.data.attendance[this.currentDate] = {};
        }

        if (!this.data.attendance[this.currentDate][this.currentChild]) {
            this.data.attendance[this.currentDate][this.currentChild] = {};
        }

        const childAttendance = this.data.attendance[this.currentDate][this.currentChild];
        const isCurrentlySelected = childAttendance[optionKey];

        if (isExclusive) {
            // For exclusive groups (Arrivée/Retour), clear other selections in the same group
            const date = new Date(this.currentDate);
            const dayType = this.getDayType(date);
            const groupOptions = this.tariffs[dayType][groupName];
            
            Object.keys(groupOptions).forEach(key => {
                delete childAttendance[key];
            });

            if (!isCurrentlySelected) {
                childAttendance[optionKey] = {
                    type: description,
                    cost: cost,
                    timestamp: new Date().toISOString()
                };
            }
        } else {
            // For non-exclusive groups (Midi), toggle individual options
            if (isCurrentlySelected) {
                delete childAttendance[optionKey];
                
                // LOGIQUE INVERSE : Si on décoche le temps de midi (12:05-13:30) et que le repas chaud est coché, on décoche aussi le repas
                if (groupName === 'Midi' && optionKey === '12:05-13:30') {
                    if (childAttendance['repas_chaud']) {
                        delete childAttendance['repas_chaud'];
                        this.showNotification('Repas chaud retiré automatiquement (plus de temps de midi)', 'info');
                    }
                }
                
            } else {
                childAttendance[optionKey] = {
                    type: description,
                    cost: cost,
                    timestamp: new Date().toISOString()
                };
                
                // AUTO-SÉLECTION : Si on sélectionne le repas chaud, auto-cocher le temps de midi
                if (groupName === 'Midi' && optionKey === 'repas_chaud') {
                    const midiTimeSlot = '12:05-13:30';
                    if (!childAttendance[midiTimeSlot]) {
                        const date = new Date(this.currentDate);
                        const dayType = this.getDayType(date);
                        const midiTariff = this.tariffs[dayType]['Midi'][midiTimeSlot];
                        
                        childAttendance[midiTimeSlot] = {
                            type: midiTariff.type,
                            cost: midiTariff.tarif,
                            timestamp: new Date().toISOString()
                        };
                        
                        this.showNotification('Temps de midi ajouté automatiquement avec le repas', 'info');
                    }
                }
            }
        }

        this.saveData();
        this.renderAttendanceOptions();
        this.updateDailySummary();
        this.renderDashboard();
    }


    updateDailySummary() {
        const summaryEl = document.getElementById('dailySummary');
        if (!summaryEl) return;

        if (!this.currentChild) {
            summaryEl.innerHTML = '';
            return;
        }

        const child = this.data.children.find(c => c.id === this.currentChild);
        const childAttendance = this.getChildAttendance(this.currentChild, this.currentDate);

        if (!childAttendance || Object.keys(childAttendance).length === 0) {
            summaryEl.innerHTML = `
                <h3>Résumé - ${child ? child.name : 'Enfant'}</h3>
                <p>Aucune sélection pour cette journée.</p>
            `;
            return;
        }

        const total = Object.values(childAttendance).reduce((sum, activity) => sum + (activity.cost || 0), 0);
        
        const itemsHTML = Object.entries(childAttendance).map(([key, activity]) => {
            const timeDisplay = key === 'repas_chaud' ? 'Repas chaud' : key;
            return `
                <div class="summary-item">
                    <span class="summary-label">${timeDisplay} - ${activity.type}</span>
                    <span class="summary-cost">${activity.cost.toFixed(2)} €</span>
                </div>
            `;
        }).join('');

        summaryEl.innerHTML = `
            <h3>Résumé - ${child ? child.name : 'Enfant'}</h3>
            <div class="summary-items">
                ${itemsHTML}
                <div class="summary-item">
                    <span class="summary-label"><strong>Total</strong></span>
                    <span class="summary-cost"><strong>${total.toFixed(2)} €</strong></span>
                </div>
            </div>
        `;
    }

    renderDashboard() {
        const emptyState = document.getElementById('emptyChildrenState');
        const normalContent = document.getElementById('normalDashboardContent');
        if (this.data.children.length === 0) {
            // Afficher le message vide, masquer le contenu normal
            emptyState.classList.remove('hidden');
            normalContent.classList.add('hidden');
        } else {
            // Masquer le message vide, afficher le contenu normal
            emptyState.classList.add('hidden');
            normalContent.classList.remove('hidden');
            this.updateCostSummary();
            this.renderChildrenStatus();
        }
    }

    updateCostSummary() {
        const dailyCost = this.calculateDayCost(this.currentDate);
        const monthlyCost = this.calculateCurrentMonthCost();
        
        const dailyCostEl = document.getElementById('dailyCost');
        const monthlyCostEl = document.getElementById('monthlyCost');
        
        if (dailyCostEl) dailyCostEl.textContent = `${dailyCost.toFixed(2)} €`;
        if (monthlyCostEl) monthlyCostEl.textContent = `${monthlyCost.toFixed(2)} €`;
    }

    renderChildrenStatus() {
        const containerEl = document.getElementById('childrenStatus');
        if (!containerEl) return;
        
        if (this.data.children.length === 0) {
            containerEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👶</div>
                    <p>Aucun enfant configuré. Ajoutez vos enfants dans l'onglet "Enfants".</p>
                </div>
            `;
            return;
        }

        const statusHTML = this.data.children.map(child => {
            const hasAttendanceToday = this.getChildAttendance(child.id, this.currentDate) &&
                Object.keys(this.getChildAttendance(child.id, this.currentDate)).length > 0;
            const status = hasAttendanceToday ? 'present' : 'absent';
            const statusText = hasAttendanceToday ? 'Présent' : 'Absent';

            return `
                <div class="child-status-card">
                    <div class="child-info">
                        <h4>${child.name}</h4>
                        <p>${child.class} - ${child.level}</p>
                    </div>
                    <div class="child-status">
                        <div class="status-indicator ${status}"></div>
                        <span>${statusText}</span>
                    </div>
                </div>
            `;
        }).join('');

        containerEl.innerHTML = `
            <div class="dashboard-header">
            <h3>État des enfants (${new Date(this.currentDate).toLocaleDateString('fr-FR')})</h3>
            </div>
            ${statusHTML}
        `;
    }

    addChild() {
        const nameEl = document.getElementById('childName');
        const classEl = document.getElementById('childClass');
        const levelEl = document.getElementById('childLevel');
        const qrCodeEl = document.getElementById('childQRCode');

        if (!nameEl?.value || !classEl?.value || !levelEl?.value) {
            this.showNotification('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }

        // Handle QR Code image
        const file = qrCodeEl.files[0];
        if (file) {
            // Check file size (max 1MB for localStorage)
            if (file.size > 1024 * 1024) {
                this.showNotification('L\'image est trop volumineuse (max 1MB)', 'error');
                return;
            }

            // Convert image to base64
            const reader = new FileReader();
            reader.onload = (e) => {
                this.createChildWithQRCode({
                    name: nameEl.value,
                    class: classEl.value,
                    level: levelEl.value,
                    qrCodeImage: e.target.result
                });
            };
            reader.onerror = () => {
                this.showNotification('Erreur lors de la lecture de l\'image', 'error');
            };
            reader.readAsDataURL(file);
        } else {
            // No QR code image
            this.createChildWithQRCode({
                name: nameEl.value,
                class: classEl.value,
                level: levelEl.value,
                qrCodeImage: null
            });
        }
    }

    createChildWithQRCode(childData) {
        const child = {
            id: Date.now().toString(),
            name: childData.name,
            class: childData.class,
            level: childData.level,
            qrCodeImage: childData.qrCodeImage
        };

        this.data.children.push(child);
        this.saveData();
        
        // Clear form
        document.getElementById('addChildForm').reset();
        
        // Update displays
        this.renderChildren();
        this.renderAttendance();
        console.log('Child added:', child);
        this.renderDashboard();
        console.log('Dashboard updated after adding child');
        
        this.showNotification(`${child.name} ajouté avec succès !`, 'success');
    }


    removeChild(childId) {
        this.confirmAction('Supprimer cet enfant',
            'Cette action supprimera définitivement cet enfant et tout son historique de présence.',
            () => {
                this.data.children = this.data.children.filter(child => child.id !== childId);
                
                // Remove attendance data for this child
                Object.keys(this.data.attendance).forEach(date => {
                    if (this.data.attendance[date] && this.data.attendance[date][childId]) {
                        delete this.data.attendance[date][childId];
                        if (Object.keys(this.data.attendance[date]).length === 0) {
                            delete this.data.attendance[date];
                        }
                    }
                });
                
                if (this.currentChild === childId) {
                    this.currentChild = null;
                }
                
                this.saveData();
                this.renderChildren();
                this.renderDashboard();
                this.updateChildSelect(); // Update the dropdown
                this.renderAttendanceOptions(); // Clear attendance options if this child was selected
                this.updateDailySummary();
                this.showNotification('Enfant supprimé avec succès');
            }
        );
    }

    renderChildren() {
        const containerEl = document.getElementById('childrenList');
        if (!containerEl) return;

        if (this.data.children.length === 0) {
            containerEl.innerHTML = `
                <div class="empty-state">
                    <p>Aucun enfant configuré. Utilisez le formulaire ci-dessus pour ajouter vos enfants.</p>
                </div>
            `;
            return;
        }

        containerEl.innerHTML = this.data.children.map(child => `
            <div class="child-card">
                <div class="child-header" onclick="app.toggleChildDetails('${child.id}')">
                    <h4>${child.name}</h4>
                    <span class="child-info">${child.class} - ${child.level}</span>
                    ${child.qrCodeImage ? '<span class="qr-indicator">📱 QR</span>' : ''}
                </div>
                <div class="child-details" id="details-${child.id}" style="display: none;">
                    ${child.qrCodeImage ? `
                        <div class="qr-code-container">
                            <img src="${child.qrCodeImage}" alt="QR Code ${child.name}" class="qr-code-image">
                        </div>
                    ` : '<p class="no-qr">Aucun QR Code configuré</p>'}
                    <div class="child-actions">
                        <button class="btn btn--danger btn--small" onclick="app.removeChild('${child.id}')">
                            🗑️ Supprimer
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }


    toggleChildDetails(childId) {
        const detailsEl = document.getElementById(`details-${childId}`);
        if (detailsEl) {
            const isVisible = detailsEl.style.display !== 'none';
            // Hide all other details first
            document.querySelectorAll('.child-details').forEach(el => {
                el.style.display = 'none';
            });
            // Toggle current one
            detailsEl.style.display = isVisible ? 'none' : 'block';
        }
    }



    renderHistory() {
        this.populateMonthSelect();
        const currentMonth = this.formatMonth(new Date());
        this.renderCalendar(currentMonth);
        this.updateMonthlySummary(currentMonth);
    }

    populateMonthSelect() {
        const selectEl = document.getElementById('monthSelect');
        if (!selectEl) return;
        
        const months = [];
        let currentDate = new Date(this.schoolYearStart);
        
        while (currentDate <= this.schoolYearEnd) {
            const monthKey = this.formatMonth(currentDate);
            const monthText = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            months.push({ value: monthKey, text: monthText });
            
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        const currentMonth = this.formatMonth(new Date());
        selectEl.innerHTML = months.map(month => 
            `<option value="${month.value}" ${month.value === currentMonth ? 'selected' : ''}>
                ${month.text}
            </option>`
        ).join('');
    }

    renderCalendar(monthKey) {
        const containerEl = document.getElementById('calendarView');
        if (!containerEl) return;
        
        // === DONNÉES DE BASE ===
        const [year, month] = monthKey.split('-');
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        
        // Informations sur le mois
        const firstDayDate = new Date(yearNum, monthNum - 1, 1);
        const monthName = firstDayDate.toLocaleDateString('fr-FR', { 
            month: 'long', 
            year: 'numeric' 
        });
        const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
        
        // Calcul du décalage (conversion JS : 0=Dimanche vers 0=Lundi)
        const firstDayOfWeekJS = firstDayDate.getDay();
        const firstDayOfWeek = (firstDayOfWeekJS + 6) % 7;
        
        // Configuration
        const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        const today = new Date();
        
        // === FONCTIONS UTILITAIRES ===
        
        // Génère l'en-tête avec les noms des jours
        const buildCalendarHeader = () => {
            return dayNames
                .map((day, index) => {
                    const weekendClass = index >= 5 ? 'weekend' : '';
                    return `<div class="calendar-header ${weekendClass}">${day}</div>`;
                })
                .join('');
        };
        
        // Génère les cellules vides avant le premier jour du mois
        const buildEmptyCells = () => {
            let html = '';
            for (let i = 0; i < firstDayOfWeek; i++) {
                const isWeekend = i >= 5;
                html += `<div class="calendar-day ${isWeekend ? 'weekend' : ''}"></div>`;
            }
            return html;
        };
        
        // Génère une cellule pour un jour donné
        const buildDayCell = (day) => {
            // Création de la clé de date
            const dateKey = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            
            // Vérification des données d'activité
            const dayData = this.data.attendance[dateKey];
            const hasActivity = dayData && Object.keys(dayData).length > 0;
            
            // Classes CSS conditionnelles
            const isToday = today.toDateString() === new Date(yearNum, monthNum - 1, day).toDateString();
            const dayOfWeek = (firstDayOfWeek + day - 1) % 7;
            const isWeekend = dayOfWeek >= 5;
            
            // Calcul du coût
            const dayCost = this.calculateDayCost(dateKey);
            
            // Construction des classes CSS
            const cssClasses = [
                'calendar-day',
                hasActivity ? 'has-activity' : '',
                isToday ? 'today' : '',
                isWeekend ? 'weekend' : ''
            ].filter(Boolean).join(' ');
            
            return `
                <div class="${cssClasses}" onclick="app.showDayDetails('${dateKey}')">
                    <div>${day}</div>
                    ${hasActivity ? `<small>${dayCost.toFixed(2)}€</small>` : ''}
                </div>
            `;
        };
        
        // === CONSTRUCTION DU CALENDRIER ===
        
        let calendarHTML = `
            <h4>Calendrier - ${monthName}</h4>
            <div class="calendar-grid">
                ${buildCalendarHeader()}
                ${buildEmptyCells()}
        `;
        
        // Génération des jours du mois
        for (let day = 1; day <= daysInMonth; day++) {
            calendarHTML += buildDayCell(day);
        }
        
        calendarHTML += '</div>';
        
        // Insertion dans le DOM
        containerEl.innerHTML = calendarHTML;
    }




    updateMonthlySummary(monthKey) {
        const calculatedCost = this.calculateMonthlyCost(monthKey);
        const calculatedCostEl = document.getElementById('calculatedCost');
        if (calculatedCostEl) {
            calculatedCostEl.textContent = `${calculatedCost.toFixed(2)} €`;
        }
        this.updateDifference();
    }

    updateDifference() {
        const calculatedCostEl = document.getElementById('calculatedCost');
        const invoiceAmountEl = document.getElementById('invoiceAmount');
        const diffElement = document.getElementById('difference');
        
        if (!calculatedCostEl || !invoiceAmountEl || !diffElement) return;
        
        const calculatedAmount = parseFloat(calculatedCostEl.textContent) || 0;
        const invoiceAmount = parseFloat(invoiceAmountEl.value) || 0;
        const difference = calculatedAmount - invoiceAmount;
        
        diffElement.textContent = `${difference.toFixed(2)} €`;
        diffElement.className = 'summary-amount';
        
        if (difference > 0.01) {
            diffElement.classList.add('text-error');
        } else if (difference < -0.01) {
            diffElement.classList.add('text-success');
        }
    }

    showDayDetails(dateKey) {
        const dayData = this.data.attendance[dateKey];
        if (!dayData) return;

        this.currentDetailDate = dateKey; // Stocker la date courante
        
        const modal = document.getElementById('dayDetailsModal');
        const title = document.getElementById('dayDetailsTitle');
        const content = document.getElementById('dayDetailsContent');
        
        // Formater la date pour l'affichage
        const date = new Date(dateKey);
        const dateStr = date.toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        title.textContent = `Détail du ${dateStr}`;
        
        // Générer le contenu détaillé
        let contentHTML = '';
        let totalDay = 0;
        
        Object.entries(dayData).forEach(([childId, childData]) => {
            const child = this.data.children.find(c => c.id === childId);
            if (!child) return;
            
            let childTotal = 0;
            let activitiesHTML = '';
            
            Object.entries(childData).forEach(([activityKey, activity]) => {
                const cost = activity.cost || 0;
                childTotal += cost;
                
                let activityName = activityKey;
                if (activityKey === 'repas_chaud') {
                    activityName = 'Repas chaud & dessert';
                }
                
                activitiesHTML += `
                    <div class="activity-item">
                        <span>${activityName}</span>
                        <span class="activity-cost">${cost.toFixed(2)}€</span>
                    </div>
                `;
            });
            
            totalDay += childTotal;
            
            contentHTML += `
                <div class="child-section">
                    <div class="child-name">${child.name}</div>
                    ${activitiesHTML}
                    <div class="total-cost">Total: ${childTotal.toFixed(2)}€</div>
                </div>
            `;
        });
        
        contentHTML += `
            <div style="margin-top: 20px; padding: 15px; border-radius: 8px; text-align: center;">
                <strong>Total de la journée : ${totalDay.toFixed(2)}€</strong>
            </div>
        `;
        
        content.innerHTML = contentHTML;
        modal.style.display = 'flex';
    }

    hideDayDetailsModal() {
        const modal = document.getElementById('dayDetailsModal');
        modal.style.display = 'none';
        this.currentDetailDate = null;
    }

    deleteDayData() {
        if (!this.currentDetailDate) return;
        
        const date = new Date(this.currentDetailDate);
        const dateStr = date.toLocaleDateString('fr-FR');
        
        this.confirmAction(
            'Supprimer les données du jour',
            `Êtes-vous sûr de vouloir supprimer toutes les présences du ${dateStr} ?`,
            () => {
                // Supprimer les données
                delete this.data.attendance[this.currentDetailDate];
                
                // Sauvegarder
                this.saveData();
                
                // Fermer la modal
                this.hideDayDetailsModal();
                
                // Rafraîchir l'affichage
                this.renderHistory();
                this.renderDashboard();
                
                // Notification
                this.showNotification(`Données du ${dateStr} supprimées`, 'success');
            }
        );
    }


    exportData() {
        const monthSelectEl = document.getElementById('monthSelect');
        const monthKey = monthSelectEl ? monthSelectEl.value : this.formatMonth(new Date());
        const data = [];
        
        Object.entries(this.data.attendance).forEach(([date, dayData]) => {
            if (date.startsWith(monthKey)) {
                Object.entries(dayData).forEach(([childId, activities]) => {
                    const child = this.data.children.find(c => c.id === childId);
                    Object.entries(activities).forEach(([time, activity]) => {
                        const timeDisplay = time === 'repas_chaud' ? 'Repas chaud' : time;
                        data.push({
                            Date: date,
                            Enfant: child?.name || 'Inconnu',
                            Horaire: timeDisplay,
                            Type: activity.type,
                            'Coût': activity.cost.toFixed(2)
                        });
                    });
                });
            }
        });

        this.downloadCSV(data, `presence-${monthKey}.csv`);
    }

    downloadCSV(data, filename) {
        if (data.length === 0) {
            this.showNotification('Aucune donnée à exporter', 'warning');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Données exportées avec succès');
    }

    resetAllData() {
        this.data.children = [];
        this.data.attendance = {};
        this.currentChild = null;
        this.saveData();
        
        this.renderAttendance();
        this.renderDashboard();
        this.renderChildren();
        this.renderHistory();
        this.showNotification('Toutes les données ont été réinitialisées');
    }

    // Utility methods
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    formatMonth(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    }

    getDayType(date) {
        const day = date.getDay();
        return day === 3 ? 'mercredi' : 'lundi-mardi-jeudi-vendredi';
    }

    getCostLevel(cost) {
        if (cost === 0) return 'free';
        if (cost <= 1) return 'low-cost';
        return 'high-cost';
    }

    getChildAttendance(childId, date) {
        return this.data.attendance[date] && this.data.attendance[date][childId] || {};
    }

    calculateDayCost(date) {
        if (!this.data.attendance[date]) return 0;
        
        let total = 0;
        Object.values(this.data.attendance[date]).forEach(childData => {
            Object.values(childData).forEach(activity => {
                total += activity.cost || 0;
            });
        });
        
        return total;
    }

    calculateCurrentMonthCost() {
        const currentMonth = this.formatMonth(new Date());
        return this.calculateMonthlyCost(currentMonth);
    }

    calculateMonthlyCost(monthKey) {
        let total = 0;
        Object.keys(this.data.attendance).forEach(date => {
            if (date.startsWith(monthKey)) {
                total += this.calculateDayCost(date);
            }
        });
        return total;
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        const container = document.getElementById('notifications');
        if (container) {
            container.appendChild(notification);
            
            setTimeout(() => notification.classList.add('show'), 100);
            
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    }

    confirmAction(title, message, callback) {
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        
        this.pendingAction = callback;
        this.showModal();
    }

    showModal() {
        const modal = document.getElementById('confirmModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideModal() {
        const modal = document.getElementById('confirmModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
}

class SupabaseSync {
    constructor(app) {
        this.app = app;
        this.supabase = null;
        this.bucketName = 'user-data';
        this.fileName = 'attendance-data.json';
        this.init();
    }

    init() {
        this.loadConfiguration();
        this.setupEventListeners();
        this.updateUI();
        if (this.isConfigured()) {
            this.updateUI('connected');
        }
    }

    setupEventListeners() {
        // Configuration
        const form = document.getElementById('syncConfigForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.configure();
            });
        }

        // Actions
        const disconnectBtn = document.getElementById('disconnectSync');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => this.disconnect());
        }

        const backupBtn = document.getElementById('backupBtn');
        if (backupBtn) {
            backupBtn.addEventListener('click', () => this.backup());
        }

        const restoreBtn = document.getElementById('restoreBtn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => this.restore());
        }
    }

    loadConfiguration() {
        const url = localStorage.getItem('supabase_url');
        const key = localStorage.getItem('supabase_key');
        const fileName = localStorage.getItem('supabase_filename');
        
        // Pré-remplir le champ fileName même si pas connecté
        const fileNameInput = document.getElementById('fileName');
        if (fileNameInput) {
            fileNameInput.value = fileName || 'attendance-data.json';
        }
        
        if (url && key && window.supabase) {
            try {
                this.supabase = window.supabase.createClient(url, key);
                
                if (fileName) {
                    this.fileName = fileName;
                }
                
                // Ne pas appeler updateUI ici, on le fera dans init()
                console.log('Configuration Supabase chargée avec succès');
                
            } catch (error) {
                console.error('Erreur de configuration Supabase:', error);
                this.supabase = null; // S'assurer que c'est null en cas d'erreur
            }
        }
    }


    validateApiKey(key) {
        const parts = key.split('.');
        if (parts.length !== 3) {
            throw new Error(`Clé invalide: ${parts.length} parties au lieu de 3`);
        }
        
        try {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.role !== 'service_role') {
                throw new Error(`Rôle incorrect: ${payload.role}. Utilisez la Service Role Key.`);
            }
            return true;
        } catch (e) {
            throw new Error(`Format JWT invalide: ${e.message}`);
        }
    }

    validateFileName(fileName) {
        const cleanName = fileName.trim();
        
        if (!cleanName) {
            throw new Error('Le nom de fichier ne peut pas être vide');
        }
        
        if (!cleanName.endsWith('.json')) {
            throw new Error('Le fichier doit avoir l\'extension .json');
        }
        
        const validPattern = /^[a-zA-Z0-9._-]+\.json$/;
        if (!validPattern.test(cleanName)) {
            throw new Error('Nom de fichier invalide. Utilisez uniquement lettres, chiffres, tirets, underscores et points');
        }
        
        return cleanName;
    }

    async configure() {
        const urlInput = document.getElementById('supabaseUrl');
        const keyInput = document.getElementById('supabaseKey');
        const fileNameInput = document.getElementById('fileName');
        
        const url = urlInput.value.trim();
        const key = keyInput.value.trim();
        const fileName = fileNameInput.value.trim();

        if (!url || !key || !fileName) {
            this.app.showNotification('Veuillez remplir tous les champs', 'error');
            return;
        }

        if (!window.supabase) {
            this.app.showNotification('SDK Supabase non chargé', 'error');
            return;
        }

        try {
            this.validateApiKey(key);
            const validFileName = this.validateFileName(fileName);
            
            const testClient = window.supabase.createClient(url, key);
            const { data: buckets, error } = await testClient.storage.listBuckets();
            
            if (error) throw error;
            
            const bucketExists = buckets.find(b => b.name === this.bucketName);
            if (!bucketExists) {
                throw new Error(`Le bucket "${this.bucketName}" n'existe pas`);
            }

            localStorage.setItem('supabase_url', url);
            localStorage.setItem('supabase_key', key);
            localStorage.setItem('supabase_filename', validFileName);
            
            this.supabase = testClient;
            this.fileName = validFileName;
            this.updateUI('connected');
            
            urlInput.value = '';
            keyInput.value = '';
            
            this.app.showNotification('Synchronisation configurée !', 'success');
            
            if (confirm('Sauvegarder vos données actuelles ?')) {
                await this.backup();
            }
            
        } catch (error) {
            console.error('Erreur:', error);
            this.app.showNotification(`Erreur: ${error.message}`, 'error');
            this.updateUI('error', error.message);
        }
    }

    disconnect() {
        if (confirm('Déconnecter la synchronisation ?')) {
            localStorage.removeItem('supabase_url');
            localStorage.removeItem('supabase_key');
            localStorage.removeItem('supabase_filename');
            localStorage.removeItem('last_backup');
            
            this.supabase = null;
            this.fileName = 'attendance-data.json';
            this.updateUI('disconnected');
            
            const fileNameInput = document.getElementById('fileName');
            if (fileNameInput) {
                fileNameInput.value = 'attendance-data.json';
            }
            
            this.app.showNotification('Synchronisation déconnectée', 'info');
        }
    }

    async backup() {
        if (!this.supabase) {
            this.app.showNotification('Synchronisation non configurée', 'error');
            return;
        }

        try {
            const currentData = {
                children: this.app.data.children,
                attendance: this.app.data.attendance,
                backupDate: new Date().toISOString(),
                fileName: this.fileName
            };

            const jsonBlob = new Blob([JSON.stringify(currentData, null, 2)], {
                type: 'application/json'
            });

            const { error } = await this.supabase.storage
                .from(this.bucketName)
                .upload(this.fileName, jsonBlob, {
                    upsert: true,
                    contentType: 'application/json'
                });

            if (error) throw error;

            const backupTime = new Date().toLocaleString('fr-FR');            
            const backupTimeISO = new Date().toISOString();
            localStorage.setItem('last_backup', backupTimeISO);
            
            this.updateLastBackupDisplay();
            this.checkForConflicts();
            this.app.showNotification(`Données sauvegardées dans ${this.fileName} !`, 'success');
            
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            this.app.showNotification(`Erreur: ${error.message}`, 'error');
        }
    }

    async restore() {
        if (!this.supabase) {
            this.app.showNotification('Synchronisation non configurée', 'error');
            return;
        }

        if (!confirm(`Restaurer depuis ${this.fileName} ? Vos données actuelles seront remplacées.`)) {
            return;
        }

        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .download(this.fileName);

            if (error) {
                if (error.message.includes('not found')) {
                    this.app.showNotification(`Aucune sauvegarde trouvée pour ${this.fileName}`, 'info');
                    return;
                }
                throw error;
            }

            const text = await data.text();
            const cloudData = JSON.parse(text);

            this.app.data.children = cloudData.children || [];
            this.app.data.attendance = cloudData.attendance || {};
            
            //this.app.saveData();

            const cloudFileDate = await this.getCloudFileDate();
            if (cloudFileDate) {
                localStorage.setItem('last_backup', cloudFileDate.toISOString());
            }
            
            this.app.renderChildren();
            this.app.renderAttendance();
            this.app.renderDashboard();
            this.app.renderHistory();

            this.updateLastBackupDisplay();
            this.checkForConflicts();
            
            this.app.showNotification(`Données restaurées depuis ${this.fileName} !`, 'success');
            
        } catch (error) {
            console.error('Erreur restoration:', error);
            this.app.showNotification(`Erreur: ${error.message}`, 'error');
        }
    }

    updateUI(status = null, errorMessage = '') {
        const statusEl = document.getElementById('syncStatus');
        const indicatorEl = document.getElementById('statusIndicator');
        const textEl = document.getElementById('statusText');
        const actionsEl = document.getElementById('syncActions');
        const disconnectBtn = document.getElementById('disconnectSync');
        const form = document.getElementById('syncConfigForm');

        if (!statusEl) return;

        // Auto-détection du statut si non fourni
        if (status === null) {
            if (this.isConfigured()) {
                status = 'connected';
            } else {
                status = 'disconnected';
            }
        }

        statusEl.className = 'sync-status';

        switch (status) {
            case 'connected':
                statusEl.classList.add('connected');
                indicatorEl.textContent = '✅';
                textEl.textContent = `Synchronisation active (${this.fileName})`;
                textEl.className = 'status--success';
                
                if (actionsEl) actionsEl.style.display = 'block';
                if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
                if (form) form.style.display = 'none';

                console.log('Mise à jour de la date de la dernière sauvegarde');
                
                this.updateLastBackupDisplay();

                // Vérifier les conflits potentiels
                this.checkForConflicts().then(result => {
                    
                });
                
                break;
                
            case 'error':
                statusEl.classList.add('error');
                indicatorEl.textContent = '❌';
                textEl.textContent = errorMessage || 'Erreur de configuration';
                textEl.className = 'status--error';
                
                if (actionsEl) actionsEl.style.display = 'none';
                if (disconnectBtn) disconnectBtn.style.display = 'none';
                if (form) form.style.display = 'block';
                break;
                
            default: // 'disconnected'
                indicatorEl.textContent = '⭕';
                textEl.textContent = 'Non configuré';
                textEl.className = 'status--info';
                
                if (actionsEl) actionsEl.style.display = 'none';
                if (disconnectBtn) disconnectBtn.style.display = 'none';
                if (form) form.style.display = 'block';
        }
    }


    async updateLastBackupDisplay() {
        const lastBackupEl = document.getElementById('lastBackup');
        const cloudLastBackupEl = document.getElementById('cloudLastBackup');
        if (!lastBackupEl) return;

        if (!this.supabase) {
            lastBackupEl.textContent = 'Non disponible';
            return;
        }
        
        const localBackup = localStorage.getItem('last_backup');
        if (localBackup) {
            // Si c'est déjà au format ISO, on l'utilise
            let displayDate;
            if (localBackup.includes('T') && localBackup.includes('Z')) {
                // Format ISO
                displayDate = new Date(localBackup);
            } else {
                // Ancien format français, on essaie de le parser
                const isoString = this.parseFrenchDateToISO(localBackup);
                displayDate = isoString ? new Date(isoString) : null;
            }
            
            if (displayDate && !isNaN(displayDate.getTime())) {
                const dateStr = displayDate.toLocaleString('fr-FR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                lastBackupEl.innerHTML = `
                    ${dateStr} 
                    <small style="color: #666;">(sync)</small>
                `;
                
            }
        } else {
            lastBackupEl.textContent = 'Jamais';
        }

        const cloudDate = await this.getCloudFileDate();
    
        if (cloudDate) {
            
            const dateStr = cloudDate.toLocaleString('fr-FR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            cloudLastBackupEl.innerHTML = `
                ${dateStr} 
                <small style="color: #999;">(cloud)</small>
            `;
        } else {
            cloudLastBackupEl.textContent = 'Jamais';
        }

        return;
    }


    isConfigured() {
        return this.supabase !== null;
    }

    async getCloudFileDate() {
        if (!this.supabase) return null;

        try {
            // Liste les fichiers dans le bucket pour trouver celui avec notre fileName
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .list('', {
                    limit: 100,
                    search: this.fileName
                });

            if (error) {
                console.error('Erreur récupération fichiers:', error);
                return null;
            }

            if (!data || data.length === 0) {
                return null; // Fichier non trouvé
            }

            // Trouver notre fichier spécifique
            const file = data.find(f => f.name === this.fileName);
            if (!file) return null;

            // Retourner la date de dernière modification
            return file.updated_at ? new Date(file.updated_at) : null;

        } catch (error) {
            console.error('Erreur lors de la récupération de la date:', error);
            return null;
        }
    }

    async checkForConflicts() {
        if (!this.supabase) return { hasConflict: false };

        try {
            const cloudDate = await this.getCloudFileDate();
            const localBackupStr = localStorage.getItem('last_backup');
            
            if (!cloudDate || !localBackupStr) {
                return { hasConflict: false };
            }

            const localDate = new Date(localBackupStr);
            const timeDiff = Math.abs(cloudDate.getTime() - localDate.getTime());

            const conflictEl = document.getElementById('conflictWarning');
            const messageEl = document.getElementById('conflictMessage');
            
            // Si plus de 5 minutes de différence, potentiel conflit
            console.log('Comparaison dates - Cloud:', cloudDate, 'Local:', localDate, 'Diff (ms):', timeDiff);
            if (timeDiff > 1 * 60 * 1000) {
                if (cloudDate > localDate) {
                    messageEl.textContent = 'Une sauvegarde plus récente existe sur le cloud';
                }
                else {
                    messageEl.textContent = 'Vos données locales sont plus récentes';
                }
                conflictEl.style.display = 'block';
                return {
                    hasConflict: true,
                    cloudDate: cloudDate,
                    localDate: localDate,
                    isCloudNewer: cloudDate > localDate
                };
            } else {
                conflictEl.style.display = 'none';
            }
            
            return { hasConflict: false };
            
        } catch (error) {
            console.error('Erreur vérification conflits:', error);
            return { hasConflict: false };
        }
    }

    parseFrenchDateToISO(frenchDateStr) {
        try {
            // Format attendu : "dd/mm/yyyy hh:mm" ou "dd/mm/yyyy à hh:mm"
            const cleanStr = frenchDateStr.replace(' à ', ' ').trim();
            const [datePart, timePart] = cleanStr.split(' ');
            
            if (!datePart || !timePart) {
                console.warn('Format de date invalide:', frenchDateStr);
                return null;
            }
            
            const [day, month, year] = datePart.split('/');
            if (!day || !month || !year) {
                console.warn('Format de date invalide:', datePart);
                return null;
            }
            
            // Construction de la chaîne ISO : YYYY-MM-DDTHH:MM:SS
            const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00`;
            
            // Vérification que la date est valide
            const testDate = new Date(isoString);
            if (isNaN(testDate.getTime())) {
                console.warn('Date ISO invalide:', isoString);
                return null;
            }
            
            return isoString;
        } catch (error) {
            console.error('Erreur parsing date française:', error);
            return null;
        }
    }


}




// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.app = new SchoolAttendanceApp();
});