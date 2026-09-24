# Audio Frequency Analyzer (DSP / FFT Analysis)

Modern web application for **Digital Signal Processing (DSP / Pengolahan Sinyal Digital)** university coursework and demonstration. 

The application analyzes `.wav` audio signals in both the **time domain (waveform)** and **frequency domain (spectrum)** using the **Radix-2 Cooley-Tukey Fast Fourier Transform (FFT)** with **Hann windowing**.

![Audio Frequency Analyzer](public/screenshot.png)

---

## 🚀 Key Features

- **WAV Audio Decoder (Web Audio API)**: Decodes raw PCM audio stream client-side to extract sample rate ($f_s$), duration, total samples ($N$), and channel configuration.
- **Time-Domain Waveform Visualization ($x(t)$)**: High-resolution downsampled audio waveform visualization with tooltips and amplitude boundaries $[-1.0, 1.0]$.
- **Fast Fourier Transform ($|X(f)|$)**: Implements the Cooley-Tukey Radix-2 FFT with Hann windowing to attenuate spectral leakage.
- **Dominant Frequency & Harmonic Detection**: Automatically identifies the fundamental frequency ($f_{\text{dom}}$) along with 2nd, 3rd, and 4th harmonic components.
- **Musical Pitch Estimation**: Calculates the nearest MIDI musical note (e.g. `A4` for 440 Hz) and cent deviation.
- **Audio Player**: Integrated playback with Web Audio synthesizer fallback for the built-in 440 Hz reference demo.
- **Export DSP Report**: Exports a detailed scientific text report (`.txt`) containing all signal parameters and spectral analysis metrics.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **DSP Engine**: Custom Radix-2 Cooley-Tukey FFT & Web Audio API
- **Deployment**: [Vercel](https://vercel.com/) / Static Hosting

---

## 📦 Getting Started

### Prerequisites

- Node.js (v18 or newer recommended, tested on Node.js 24)
- npm or pnpm

### Installation

1. Clone or navigate to the repository:
   ```bash
   cd audio-frequency-analyzer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3000` (or the URL displayed in terminal).

4. Build for production:
   ```bash
   npm run build
   ```
   The production bundle will be generated in the `dist/` directory.

---

## 🌐 Deploy to Vercel

### Option 1: Via Vercel Web Dashboard (Recommended)
1. Push this repository to your GitHub account:
   ```bash
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and log in.
3. Click **"Add New Project"** and import your `audio-frequency-analyzer` repository.
4. Framework Preset will be automatically detected as **Vite**.
5. Click **"Deploy"**.

### Option 2: Via Vercel CLI
```bash
npx vercel
```

---

## 📚 Mathematical Foundations

### 1. Discrete Fourier Transform (DFT)
$$X(k) = \sum_{n=0}^{N-1} x(n) \cdot e^{-j \frac{2\pi}{N} k n}, \quad k = 0, 1, \dots, N-1$$

### 2. Nyquist-Shannon Theorem
To avoid aliasing distortion, the sampling frequency $f_s$ must satisfy:
$$f_s \ge 2 f_{\max} \implies f_{\text{nyquist}} = \frac{f_s}{2}$$

---

## 📄 License
MIT License. Created for Digital Signal Processing (DSP) academic research and projects.
