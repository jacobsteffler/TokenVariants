export class TVA_Sprite extends PIXI.Sprite {
  constructor(texture, token, config) {
    super(texture);

    this.tvaOverlayConfig = mergeObject(
      {
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
        angle: 0,
        filter: 'NONE',
        inheritTint: false,
        underlay: false,
        linkRotation: true,
        linkMirror: true,
        linkOpacity: false,
        mirror: false,
        tint: null,
        loop: true,
        playOnce: false,
      },
      config
    );
    this.token = token;
    this.visible = false;
    this._tvaPlay().then(() => this.refresh());
  }

  async _tvaPlay() {
    // Ensure playback state for video
    const source = foundry.utils.getProperty(this.texture, 'baseTexture.resource.source');
    if (source && source.tagName === 'VIDEO') {
      // Detach video from others
      const s = source.cloneNode();

      if (this.tvaOverlayConfig.playOnce) {
        s.onended = () => {
          this.alpha = 0;
          this.tvaVideoEnded = true;
        };
      }

      await new Promise((resolve) => (s.oncanplay = resolve));
      this.texture = PIXI.Texture.from(s, { resourceOptions: { autoPlay: false } });

      const options = {
        loop: this.tvaOverlayConfig.loop && !this.tvaOverlayConfig.playOnce,
        volume: 0,
        offset: 0,
        playing: true,
      };
      game.video.play(s, options);
    }
  }

  refresh(configuration, preview = false) {
    if (!this.texture) return;
    this.visible = false;
    const config = mergeObject(this.tvaOverlayConfig, configuration, { inplace: !preview });

    const source = foundry.utils.getProperty(this.texture, 'baseTexture.resource.source');
    if (source && source.tagName === 'VIDEO') {
      if (!source.loop && config.loop) {
        game.video.play(source);
      } else if (source.loop && !config.loop) {
        game.video.stop(source);
      }
      source.loop = config.loop;
    }

    if (this.anchor) this.anchor.set(0.5 + config.offsetX, 0.5 + config.offsetY);

    // Scale the image using the same logic as the token
    const tex = this.texture;
    let aspect = tex.width / tex.height;
    const scale = this.scale;
    if (aspect >= 1) {
      this.width = this.token.w * this.token.document.texture.scaleX;
      scale.y = Number(scale.x);
    } else {
      this.height = this.token.h * this.token.document.texture.scaleY;
      scale.x = Number(scale.y);
    }

    // Center the image
    this.position.set(this.token.w / 2, this.token.h / 2);

    // Adjust scale according to config
    this.scale.x = this.scale.x * config.scaleX;
    this.scale.y = this.scale.y * config.scaleY;

    // Check if mirroring should be inherited from the token and if so apply it
    if (config.linkMirror) {
      this.scale.x = Math.abs(this.scale.x) * (this.token.document.texture.scaleX < 0 ? -1 : 1);
      this.scale.y = Math.abs(this.scale.y) * (this.token.document.texture.scaleY < 0 ? -1 : 1);
    }

    // Set alpha but only if playOnce is disabled and the video hasn't
    // finished playing yet. Otherwise we want to keep alpha as 0 to keep the video hidden
    if (!this.tvaVideoEnded) {
      this.alpha = config.linkOpacity ? this.token.alpha : config.alpha;
    }

    let filter = PIXI.filters[config.filter];
    if (filter) {
      this.filters = [new filter()];
    } else {
      this.filters = [];
    }

    // Angle in degrees
    this.angle = config.linkRotation ? this.token.rotation + config.angle : config.angle;

    // Apply color tinting
    const tint = config.inheritTint ? this.token.document.texture.tint : config.tint;
    this.tint = tint ? foundry.utils.colorStringToHex(tint) : 0xffffff;

    this.visible = true;
  }

  destroy() {
    if (this.texture?.baseTexture.resource.source?.tagName === 'VIDEO') {
      this.texture.baseTexture.destroy();
    }
    super.destroy();
  }
}
