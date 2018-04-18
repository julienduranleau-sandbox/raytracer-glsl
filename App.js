class App {
  constructor() {
    this.stats = new Stats()

    this.glslSandbox = new GlslSandbox(640, 480, null, 'shader.frag')
    this.glslSandbox.autoResize = false
    this.glslSandbox.on('geometry-initialization', (e) => this.geomInit(e.material, e.geometry))
    this.glslSandbox.on('pre-render', () => this.update())

    document.body.appendChild(this.glslSandbox.dom)
    document.body.appendChild(this.stats.dom)
  }

  geomInit(material, geometry) {
    /*
    material.uniforms.subdivisions = {
        type: 'i', value: this.subdivisionSlider.value
    }
    */
  }

  update() {
    this.stats.update()
  }
}
