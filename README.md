# 🎬 Chroma Key Tool

A simple **Green Screen (Chroma Key) removal tool** for MP4 videos.  
Runs **100% offline** in the browser — no backend, no server needed.

---

## ✨ Features

- Upload any MP4 video with a green screen
- Remove green background in real-time
- Replace with a **custom background image** or **transparent background**
- Adjust **green tolerance**, **edge softness**, and **spill suppression**
- Live preview while the video plays
- Export the processed video as **WebM** with audio included

---

## 🚀 Live Demo

👉 [https://html-ramu.github.io/chroma-key-tool](https://html-ramu.github.io/chroma-key-tool)

---

## 📁 Files

| File | Purpose |
|------|---------|
| `index.html` | Main HTML structure |
| `style.css` | Dark theme UI styling |
| `script.js` | Chroma key logic + export |

---

## 🛠️ How to Use

1. Open `index.html` in Chrome or Firefox
2. Upload your `.mp4` green screen video
3. Optionally upload a background image
4. Adjust the **Green Tolerance** slider (start at 40–60)
5. Use **Edge Softness** to smooth cutout edges
6. Use **Spill Suppression** to remove green glow
7. Click **Export as WebM** to download

---

## 🧠 How It Works

- Each video frame is drawn onto an **HTML Canvas**
- Every pixel is checked: if green dominates → alpha set to 0 (transparent)
- Background image or color is composited underneath
- **Web Audio API** captures audio from the video for export
- **MediaRecorder API** records the canvas stream to `.webm`

---

## 📦 Tech Stack

- HTML5 Canvas API
- Web Audio API
- MediaRecorder API
- Vanilla JavaScript (no libraries)

---

## 👨‍💻 Author

Made by [html-ramu](https://github.com/html-ramu)
