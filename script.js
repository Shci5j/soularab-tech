document.getElementById('colorBtn').addEventListener('click', function() {
    const colors = ['#f4f4f9', '#e3f2fd', '#e8f5e9', '#fff3e0', '#fce4ec'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    document.body.style.backgroundColor = randomColor;
});
