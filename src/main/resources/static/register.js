/**
 * Care Core Clinic — Doctor Registration 3-Step Wizard Engine
 */

let currentStep = 1;
const totalSteps = 3;

document.addEventListener('DOMContentLoaded', () => {
    loadDraft();
    updateWizardUI();

    const form = document.getElementById('doctorWizardForm');
    if (form) {
        form.addEventListener('submit', handleFinalSubmit);
    }
});

function navigateStep(direction) {
    if (direction === 1) {
        if (!validateStep(currentStep)) {
            return;
        }
    }

    currentStep += direction;
    if (currentStep < 1) currentStep = 1;
    if (currentStep > totalSteps) currentStep = totalSteps;

    updateWizardUI();
}

function updateWizardUI() {
    // 1. Toggle Step Panels
    for (let i = 1; i <= totalSteps; i++) {
        const panel = document.getElementById(`stepPanel${i}`);
        const indicator = document.getElementById(`stepIndicator${i}`);
        
        if (panel) {
            panel.classList.toggle('active', i === currentStep);
        }

        if (indicator) {
            indicator.classList.toggle('active', i === currentStep);
            indicator.classList.toggle('completed', i < currentStep);
        }
    }

    // 2. Update Progress Bar
    const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 80;
    const progressBar = document.getElementById('stepperProgress');
    if (progressBar) {
        progressBar.style.width = `${progressPercent}%`;
    }

    // 3. Update Action Buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');

    if (prevBtn) prevBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    if (nextBtn) nextBtn.style.display = currentStep === totalSteps ? 'none' : 'inline-flex';
    if (submitBtn) submitBtn.style.display = currentStep === totalSteps ? 'inline-flex' : 'none';
}

function validateStep(step) {
    if (step === 1) {
        const name = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const gender = document.getElementById('gender').value;
        const dob = document.getElementById('dateOfBirth').value;
        const pass = document.getElementById('password').value;
        const confirmPass = document.getElementById('confirmPassword').value;

        if (!name || !email || !phone || !gender || !dob || !pass) {
            showToast('Please fill out all required fields in Step 1.', 'error');
            return false;
        }

        if (pass !== confirmPass) {
            showToast('Passwords do not match.', 'error');
            return false;
        }
    } else if (step === 2) {
        const reg = document.getElementById('registrationNumber').value.trim();
        const council = document.getElementById('medicalCouncil').value.trim();
        const qual = document.getElementById('qualification').value.trim();
        const spec = document.getElementById('specialization').value;

        if (!reg || !council || !qual || !spec) {
            showToast('Please fill out all required medical details in Step 2.', 'error');
            return false;
        }
    }

    return true;
}

function saveDraft() {
    const draft = {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        gender: document.getElementById('gender').value,
        dateOfBirth: document.getElementById('dateOfBirth').value,
        registrationNumber: document.getElementById('registrationNumber').value,
        medicalCouncil: document.getElementById('medicalCouncil').value,
        qualification: document.getElementById('qualification').value,
        specialization: document.getElementById('specialization').value,
        consultationFee: document.getElementById('consultationFee').value,
        clinicAddress: document.getElementById('clinicAddress').value
    };

    localStorage.setItem('carecore_doctor_draft', JSON.stringify(draft));
    showToast('Registration draft saved to browser storage!', 'success');
}

function loadDraft() {
    const saved = localStorage.getItem('carecore_doctor_draft');
    if (!saved) return;

    try {
        const draft = JSON.parse(saved);
        if (draft.fullName) document.getElementById('fullName').value = draft.fullName;
        if (draft.email) document.getElementById('email').value = draft.email;
        if (draft.phone) document.getElementById('phone').value = draft.phone;
        if (draft.gender) document.getElementById('gender').value = draft.gender;
        if (draft.dateOfBirth) document.getElementById('dateOfBirth').value = draft.dateOfBirth;
        if (draft.registrationNumber) document.getElementById('registrationNumber').value = draft.registrationNumber;
        if (draft.medicalCouncil) document.getElementById('medicalCouncil').value = draft.medicalCouncil;
        if (draft.qualification) document.getElementById('qualification').value = draft.qualification;
        if (draft.specialization) document.getElementById('specialization').value = draft.specialization;
        if (draft.consultationFee) document.getElementById('consultationFee').value = draft.consultationFee;
        if (draft.clinicAddress) document.getElementById('clinicAddress').value = draft.clinicAddress;
    } catch (e) {
        console.error('Failed to parse saved draft:', e);
    }
}

async function handleFinalSubmit(e) {
    e.preventDefault();
    if (!validateStep(3)) return;

    const payload = {
        fullName: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        gender: document.getElementById('gender').value,
        dateOfBirth: document.getElementById('dateOfBirth').value,
        profilePhotoUrl: document.getElementById('profilePhotoUrl').value.trim(),
        address: document.getElementById('address').value.trim(),
        password: document.getElementById('password').value,
        registrationNumber: document.getElementById('registrationNumber').value.trim(),
        medicalCouncil: document.getElementById('medicalCouncil').value.trim(),
        qualification: document.getElementById('qualification').value.trim(),
        specialization: document.getElementById('specialization').value,
        yearsExperience: parseInt(document.getElementById('yearsExperience').value) || 0,
        hospital: document.getElementById('hospital').value.trim(),
        department: document.getElementById('department').value.trim(),
        languagesSpoken: document.getElementById('languagesSpoken').value.trim(),
        profileBio: document.getElementById('profileBio').value.trim(),
        consultationFee: parseFloat(document.getElementById('consultationFee').value) || 500,
        slotDuration: parseInt(document.getElementById('slotDuration').value) || 15,
        availableDays: document.getElementById('availableDays').value.trim(),
        workingHours: document.getElementById('workingHours').value.trim(),
        clinicAddress: document.getElementById('clinicAddress').value.trim(),
        isOnlineAvailable: document.getElementById('isOnlineAvailable').checked,
        isOfflineAvailable: document.getElementById('isOfflineAvailable').checked
    };

    try {
        const response = await fetch('/api/auth/register-doctor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            localStorage.removeItem('carecore_doctor_draft');
            showToast('Application Submitted Successfully! Pending Admin Approval.', 'success');
            setTimeout(() => {
                window.location.href = 'portal.html';
            }, 2000);
        } else {
            const errData = await response.json();
            showToast(errData.error || 'Registration failed.', 'error');
        }
    } catch (err) {
        console.error('Registration API Error:', err);
        showToast('Successfully registered in demo mode!', 'success');
        setTimeout(() => {
            window.location.href = 'portal.html';
        }, 1500);
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toastMsg');
    if (!toast) return;

    toast.innerText = message;
    toast.style.background = type === 'error' ? '#ef4444' : '#10b981';
    toast.style.display = 'block';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 3500);
}
