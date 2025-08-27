class SchoolAttendanceApp {
    constructor() {
        this.data = {
            children: [],
            attendance: {}
        };
        
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
        this.currentTab = 'attendance';
        this.pendingAction = null;
        
        // School year limits
        this.schoolYearStart = new Date('2025-08-01');
        this.schoolYearEnd = new Date('2026-07-31');
        
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
            case 'attendance':
                this.renderAttendance();
                break;
            case 'dashboard':
                this.renderDashboard();
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
            } else {
                childAttendance[optionKey] = {
                    type: description,
                    cost: cost,
                    timestamp: new Date().toISOString()
                };
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
        this.updateCostSummary();
        this.renderChildrenStatus();
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
            <h3>État des enfants (${new Date(this.currentDate).toLocaleDateString('fr-FR')})</h3>
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
            <div class="child-card" onclick="app.toggleChildDetails('${child.id}')">
                <div class="child-header">
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
                    <button class="btn btn--danger btn--small" onclick="event.stopPropagation(); app.removeChild('${child.id}')">
                        Supprimer
                    </button>
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
        
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        
        const monthName = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
        const firstDayOfWeek = new Date(parseInt(year), parseInt(month) - 1, 1).getDay();
        const today = new Date();
        
        const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        
        let calendarHTML = `
            <h4>Calendrier - ${monthName}</h4>
            <div class="calendar-grid">
                ${dayNames.map(day => `<div class="calendar-header">${day}</div>`).join('')}
        `;

        // Empty cells for days before the first day of the month
        for (let i = 0; i < firstDayOfWeek; i++) {
            calendarHTML += '<div class="calendar-day"></div>';
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const hasActivity = this.data.attendance[dateKey] && Object.keys(this.data.attendance[dateKey]).length > 0;
            const isToday = today.toDateString() === new Date(parseInt(year), parseInt(month) - 1, day).toDateString();
            const dayCost = this.calculateDayCost(dateKey);
            
            calendarHTML += `
                <div class="calendar-day ${hasActivity ? 'has-activity' : ''} ${isToday ? 'today' : ''}" 
                     onclick="app.showDayDetails('${dateKey}')">
                    <div>${day}</div>
                    ${hasActivity ? `<small>${dayCost.toFixed(2)}€</small>` : ''}
                </div>
            `;
        }

        calendarHTML += '</div>';
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
        if (!dayData) {
            this.showNotification('Aucune activité pour cette journée');
            return;
        }

        let details = `Détails du ${new Date(dateKey).toLocaleDateString('fr-FR')}:\n\n`;
        
        Object.entries(dayData).forEach(([childId, activities]) => {
            const child = this.data.children.find(c => c.id === childId);
            if (child) {
                details += `${child.name}:\n`;
                Object.entries(activities).forEach(([time, activity]) => {
                    const timeDisplay = time === 'repas_chaud' ? 'Repas chaud' : time;
                    details += `  ${timeDisplay}: ${activity.type} (${activity.cost.toFixed(2)}€)\n`;
                });
                details += '\n';
            }
        });

        alert(details);
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

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.app = new SchoolAttendanceApp();
});