class GlslSandbox {
  constructor(width, height, vertexShaderUrl, fragmentShaderUrl) {
    this.width = width
    this.height = height
    this.autoResize = true
    this.fragmentShader = null
    this.vertexShader = null
    this.domContainer = null
    this.startDate = Date.now()
    this.currentFrame = 1;
    this.events = {
      "geometry-initialization": [],
      "pre-render": [],
      "post-render": [],
    }

    this.camera = null
    this.scene = null
    this.renderer = null
    this.mesh = null

    this.domContainer = document.createElement('div')
    this.domContainer.classList.add('glslSandboxContainer');

    this.loadShaders(fragmentShaderUrl, vertexShaderUrl).then(() => this.initThreejs())
  }

  get dom() {
    return this.domContainer
  }

  on(event, fn) {
    if (this.events[event]) {
      this.events[event].push(fn)
    } else {
      this.events[event] = [fn]
    }
  }

  fire(event, params) {
    if (this.events[event]) {
      this.events[event].forEach(fn => fn(params))
    }
  }

  loadShaders(fragmentShaderUrl, vertexShaderUrl) {
    return new Promise((resolve, reject) => {
      let nShadersToLoad = 0

      if (fragmentShaderUrl) nShadersToLoad++
      if (vertexShaderUrl) nShadersToLoad++

      if (nShadersToLoad === 0) {
        console.warn('No shaders to load!')
        reject()
      }

      if (fragmentShaderUrl) {
        this.loadShader(fragmentShaderUrl).then((shaderText) => {
          this.fragmentShader = shaderText
          nShadersToLoad--
          if (nShadersToLoad == 0) {
            resolve()
          }
        })
      }

      if (vertexShaderUrl) {
        this.loadShader(fragmentShaderUrl).then((shaderText) => {
          this.fragmentShader = shaderText
          nShadersToLoad--
          if (nShadersToLoad == 0) {
            resolve()
          }
        })
      }
    })
  }

  loadShader(url) {
    return new Promise((resolve, reject) => {
      fetch(url).then(req => req.text()).then(shaderText => {
        resolve(shaderText)
      })
    })
  }

  initThreejs() {
    this.renderer = new THREE.WebGLRenderer()
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(this.width, this.height)

    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 1, 10000)
    this.camera.position.z = 300

    this.scene = new THREE.Scene()

    this.initGeometry()

    this.renderer.domElement.classList.add('glslSandboxCanvas')
    this.domContainer.appendChild(this.renderer.domElement)

    window.addEventListener('resize', () => this.onWindowResize(), false)

    this.update()
  }

  initGeometry() {
    let planeGeometry = new THREE.PlaneBufferGeometry(this.width, this.height)

    let mat = new THREE.ShaderMaterial({
      uniforms: {
        iResolution : { type: 'v2', value: new THREE.Vector2(this.width, this.height) },
        iTime : { type: 'f', value: 0 },
        iFrame : { type: 'f', value: this.currentFrame }
      },
      //vertexShader: this.vertexShader || undefined,
      fragmentShader: this.fragmentShader || undefined
    })

    this.fire('geometry-initialization', {
      material: mat,
      geometry: planeGeometry
    })

    this.mesh = new THREE.Mesh(planeGeometry, mat)
    this.scene.add(this.mesh)

    window.mesh = this.mesh
  }

  onWindowResize() {
    if (this.autoResize) {
      this.width = window.innerWidth
      this.height = window.innerHeight
      this.camera.aspect = this.width / this.height
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(this.width, this.height)
    }
  }

  update() {
    requestAnimationFrame(this.update.bind(this))

    this.mesh.material.uniforms.iTime.value = (Date.now() - this.startDate) / 1000
    this.mesh.material.uniforms.iFrame.value = ++this.currentFrame
    this.mesh.material.needsUpdate = true

    this.fire('pre-render')

    this.renderer.render(this.scene, this.camera)

    this.fire('post-render')
  }
}
