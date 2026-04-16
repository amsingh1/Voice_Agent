// AudioWorklet processor for real-time PCM16 playback.
// Receives Int16Array chunks from the main thread and plays them.

class AudioPlayerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);

    this.port.onmessage = (event) => {
      if (event.data.type === 'audio') {
        const int16 = new Int16Array(event.data.data);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
        }
        const newBuffer = new Float32Array(this._buffer.length + float32.length);
        newBuffer.set(this._buffer);
        newBuffer.set(float32, this._buffer.length);
        this._buffer = newBuffer;
      } else if (event.data.type === 'clear') {
        this._buffer = new Float32Array(0);
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const channelData = output[0];
    const samplesToWrite = Math.min(channelData.length, this._buffer.length);

    if (samplesToWrite > 0) {
      channelData.set(this._buffer.subarray(0, samplesToWrite));
      this._buffer = this._buffer.slice(samplesToWrite);
      for (let i = samplesToWrite; i < channelData.length; i++) {
        channelData[i] = 0;
      }
    } else {
      channelData.fill(0);
    }

    return true;
  }
}

registerProcessor('audio-player-worklet', AudioPlayerWorklet);
