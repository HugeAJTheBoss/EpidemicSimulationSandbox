async function fetchFrame() {
    const response = await fetch('/sim_frame.png');
    const blob = await response.blob();

    // Create canvas
    const canvas = document.getElementById('simulation');
    const ctx = canvas.getContext('2d');
    canvas.width = 1440;
    canvas.height = 720;

    // Load and decompress PNG
    const img = new Image();
    const imageUrl = URL.createObjectURL(blob);

    img.onload = () => {
        // Draw to canvas
        ctx.drawImage(img, 0, 0);

        // Get full pixel data - EXACT same RGB values as MATLAB sent
        const imageData = ctx.getImageData(0, 0, 1440, 720);

        // Now you have complete pixel access
        canvas.onmousemove = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) * (1440 / rect.width));
            const y = Math.floor((e.clientY - rect.top) * (720 / rect.height));
            const index = (y * 1440 + x) * 4;

            const r = imageData.data[index];
            const g = imageData.data[index + 1];
            const b = imageData.data[index + 2];

            // Display info (create a div for this)
            document.getElementById('pixel-info').textContent =
                `Pixel (${x}, ${y}): R=${r} G=${g} B=${b}`;
        };

        // Clean up
        URL.revokeObjectURL(imageUrl);
    };

    img.src = imageUrl;
}

// Poll at 2fps
setInterval(fetchFrame, 500);