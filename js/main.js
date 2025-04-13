document.addEventListener('DOMContentLoaded', function() {
    hljs.highlightAll();
});

function copyToClipboard() {
    const url = document.getElementById('apiUrl').textContent;
    const button = document.querySelector('.copy-button');
    
    navigator.clipboard.writeText(url).then(() => {
        button.textContent = 'Copied!';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.textContent = 'Copy URL';
            button.classList.remove('copied');
        }, 2000);
    });
}

function switchTab(tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove('active');
    }
    
    const tabButtons = document.getElementsByClassName('tab-button');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove('active');
    }
    
    document.getElementById(tabName + '-tab').classList.add('active');
    
    const buttons = document.getElementsByClassName('tab-button');
    for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].textContent.toLowerCase().includes(tabName)) {
            buttons[i].classList.add('active');
        }
    }
}
