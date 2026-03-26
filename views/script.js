const API_BASE = '/api/items';

let currentFilter = 'all';// default showing all post (lost/found)
let itemsData = [];
let currentSearch = '';
let currentStartDate = '';
let currentEndDate = '';

// element object
const itemsContainer = document.getElementById('itemsContainer');
const submitBtn = document.getElementById('submitItemBtn');
const showLostBtn = document.getElementById('showLostBtn');
const showFoundBtn = document.getElementById('showFoundBtn');
const showAllBtn = document.getElementById('showAllBtn');
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const startDateInput = document.getElementById('startDateInput');
const endDateInput = document.getElementById('endDateInput');
const searchStats = document.getElementById('searchStats');
const itemImageInput = document.getElementById('itemImage');
const imagePreview = document.getElementById('imagePreview');
const itemTypeSelect = document.getElementById('itemType');

// select lost/found publish type
function updateSelectStyle() {
    const selectedValue = itemTypeSelect.value;
    itemTypeSelect.classList.remove('lost-selected', 'found-selected');
    
    if (selectedValue === 'lost') {
        itemTypeSelect.classList.add('lost-selected');
    } else if (selectedValue === 'found') {
        itemTypeSelect.classList.add('found-selected');
    }
}
itemTypeSelect.addEventListener('change', updateSelectStyle);

// preview img
itemImageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            imagePreview.innerHTML = `<img src="${event.target.result}" alt="Preview" style="max-width: 100px; max-height: 100px; border-radius: 8px; margin-top: 8px;">`;
        };
        reader.readAsDataURL(file);
    } else {
        imagePreview.innerHTML = '';
    }
});

// get item
async function fetchItems() {
    try {
        const params = new URLSearchParams();
        if (currentSearch) params.append('search', currentSearch);
        if (currentStartDate) params.append('startDate', currentStartDate);
        if (currentEndDate) params.append('endDate', currentEndDate);
        
        const url = `${API_BASE}${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch');
        const items = await response.json();
        itemsData = items;
        renderItemsByFilter();
        updateSearchStats();
    } catch (err) {
        console.error('Error fetching items:', err);
        itemsContainer.innerHTML = `
            <div class="empty-state">
                Cannot connect to backend...
            </div>
        `;
    }
}

// update search
function updateSearchStats() {
    if (currentSearch || currentStartDate || currentEndDate) {
        let statsText = `Found ${itemsData.length} result(s)`;
        if (currentSearch) statsText += ` for "${currentSearch}"`;
        if (currentStartDate) statsText += ` from ${currentStartDate}`;
        if (currentEndDate) statsText += ` to ${currentEndDate}`;
        searchStats.textContent = statsText;
        searchStats.style.display = 'block';
    } else {
        searchStats.style.display = 'none';
    }
}

// start searching
function performSearch() {
    currentSearch = searchInput.value.trim();
    currentStartDate = startDateInput.value;
    currentEndDate = endDateInput.value;
    fetchItems();
}

// reset searching
function resetSearch() {
    searchInput.value = '';
    startDateInput.value = '';
    endDateInput.value = '';
    currentSearch = '';
    currentStartDate = '';
    currentEndDate = '';
    fetchItems();
}

// matching item
function renderItemsByFilter() {
    let filtered = [];
    if (currentFilter === 'lost') {
        filtered = itemsData.filter(item => item.type === 'lost');
    } else if (currentFilter === 'found') {
        filtered = itemsData.filter(item => item.type === 'found');
    } else {
        filtered = [...itemsData];
    }

    if (filtered.length === 0) {
        itemsContainer.innerHTML = `
            <div class="empty-state">
                No ${currentFilter !== 'all' ? currentFilter : ''} items to show. 
                Be the first to report!
            </div>
        `;
        return;
    }

    const cardsHtml = filtered.map(item => `
        <div class="item-card" data-id="${item.id}">
            ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.title)}" class="item-image">` : ''}
            <span class="item-type ${item.type === 'lost' ? 'type-lost' : 'type-found'}">
                ${item.type === 'lost' ? 'LOST' : 'FOUND'}
            </span>
            <div class="item-title">${escapeHtml(item.title)}</div>
            <div class="item-desc">${escapeHtml(item.description || 'No description provided.')}</div>
            <div class="item-meta">
                <span>📍 ${escapeHtml(item.location || 'Unknown')}</span>
                <span>📅 ${formatIncidentDate(item.incidentDate)}</span>
                <span>📞 ${escapeHtml(item.contact || 'No contact')}</span>
                <span>🕒 ${formatDate(item.createdAt)}</span>
            </div>
            <button class="claim-btn" data-id="${item.id}">
                ${item.type === 'lost' ? 'I found this!' : 'Claim / Contact'}
            </button>
            <button class="delete-btn" data-id="${item.id}">
                Remove (demo resolve)
            </button>
        </div>
    `).join('');

    itemsContainer.innerHTML = cardsHtml;

    // object seleter
    document.querySelectorAll('.claim-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.getAttribute('data-id');
            await handleClaim(id);
        });
    });
    
    // object selecter delete
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.getAttribute('data-id');
            await handleDelete(id);
        });
    });
}

// meet item *** to be develop more(demo now)
async function handleClaim(id) {
    const item = itemsData.find(i => i.id == id);
    if (!item) return;
    
    alert(`Regarding "${item.title}"\n\nOwner contact: ${item.contact}\n\nThis is a demo — please reach out directly. The item status can be removed after resolution.`);
}

// delete item(***only admin when open to public web site ,to be develop)
async function handleDelete(id) {
    if (confirm('Are you sure? This will remove the item (demo resolution workflow).')) {
        try {
            const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await fetchItems();
            } else {
                alert('Error deleting item');
            }
        } catch (err) {
            console.error(err);
            alert('Server error');
        }
    }
}

// post item
async function createItem(formData) {
    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Post failed');
        }
        
        await fetchItems();
        
        resetForm();
        
    } catch (err) {
        console.error(err);
        alert('Could not publish item. ' + err.message);
    }
}

// clear form
function resetForm() {
    document.getElementById('itemTitle').value = '';
    document.getElementById('itemDesc').value = '';
    document.getElementById('itemLocation').value = '';
    document.getElementById('itemContact').value = '';
    document.getElementById('itemIncidentDate').value = '';
    if (itemImageInput) itemImageInput.value = '';
    if (imagePreview) imagePreview.innerHTML = '';
    document.getElementById('itemType').value = 'lost';
    updateSelectStyle();
    setDefaultIncidentDate();
}

// publish button
function onPublish() {
    const type = document.getElementById('itemType').value;
    const title = document.getElementById('itemTitle').value.trim();
    const location = document.getElementById('itemLocation').value.trim();
    const description = document.getElementById('itemDesc').value.trim();
    const contact = document.getElementById('itemContact').value.trim();
    const incidentDate = document.getElementById('itemIncidentDate').value;
    const imageFile = document.getElementById('itemImage').files[0];

    if (!title) {
        alert('Please provide a title for the item.');
        return;
    }
    if (!contact) {
        alert('Please provide a contact method (email/phone).');
        return;
    }
    if (!incidentDate) {
        alert('Please provide the date when the item was lost or found.');
        return;
    }

    const formData = new FormData();
    formData.append('type', type);
    formData.append('title', title);
    formData.append('location', location || 'Not specified');
    formData.append('description', description || '');
    formData.append('contact', contact);
    formData.append('incidentDate', incidentDate);
    if (imageFile) {
        formData.append('image', imageFile);
    }

    createItem(formData);
}

// search filter
function setFilter(filter) {
    currentFilter = filter;
    
    showLostBtn.classList.remove('active');
    showFoundBtn.classList.remove('active');
    showAllBtn.classList.remove('active');
    
    if (filter === 'lost') showLostBtn.classList.add('active');
    else if (filter === 'found') showFoundBtn.classList.add('active');
    else showAllBtn.classList.add('active');
    
    renderItemsByFilter();
}

// testing
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// formating data
function formatDate(dateStr) {
    if (!dateStr) return 'just now';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } catch(e) { 
        return 'recent'; 
    }
}

// event date
function formatIncidentDate(dateStr) {
    if (!dateStr) return 'Date not specified';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { 
            year: 'numeric',
            month: 'short', 
            day: 'numeric'
        });
    } catch(e) { 
        return dateStr; 
    }
}

// today date
function setDefaultIncidentDate() {
    const today = new Date().toISOString().split('T')[0];
    const incidentDateInput = document.getElementById('itemIncidentDate');
    if (!incidentDateInput.value) {
        incidentDateInput.value = today;
    }
}

// function caller
submitBtn.addEventListener('click', onPublish);
showLostBtn.addEventListener('click', () => setFilter('lost'));
showFoundBtn.addEventListener('click', () => setFilter('found'));
showAllBtn.addEventListener('click', () => setFilter('all'));
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});



updateSelectStyle();
fetchItems();
setDefaultIncidentDate();