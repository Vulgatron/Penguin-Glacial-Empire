(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GlacialCore = root.GlacialCore || {};
  root.GlacialCore.ParadeEvent = api;
  root.ParadeController = api.ParadeController;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PARADE_INTERVAL_SEC = 900; // Every 15 minutes
  const PARADE_BOOST_DURATION_SEC = 60; // Automatic 60s fish production boost
  const PARADE_BOOST_MULTIPLIER = 2; // 2x fish production during boost
  const PARADE_SPACING_PX = 42;
  const PARADE_MARCH_SPEED_PX = 68;
  const PARADE_CHIME_INTERVAL_SEC = 2.6;
  const PARADE_MAX_GATHER_SEC = 2.4;
  const PARADE_EDGE_MARGIN_PX = 34;

  // Regal Emperor leads the parade line, followed by Cyber, Chinstrap, Gentoo, and Adélie
  const SPECIES_PARADE_PRIORITY = {
    emperor: 0,
    cyber: 1,
    chinstrap: 2,
    gentoo: 3,
    adelie: 4
  };

  function computeParadeLaneY(height, visibleBottomY) {
    const safeH = (Number.isFinite(height) && height > 100) ? height : 640;
    const minLaneY = safeH * 0.435;
    const idealLaneY = safeH * 0.545;
    if (Number.isFinite(visibleBottomY) && visibleBottomY > 0) {
      return Math.max(minLaneY, Math.min(idealLaneY, visibleBottomY - 24));
    }
    return idealLaneY;
  }

  function sortPenguinsForParade(penguins) {
    if (!Array.isArray(penguins)) return [];
    return penguins.slice().sort((a, b) => {
      const pa = Object.prototype.hasOwnProperty.call(SPECIES_PARADE_PRIORITY, a.speciesId)
        ? SPECIES_PARADE_PRIORITY[a.speciesId]
        : 99;
      const pb = Object.prototype.hasOwnProperty.call(SPECIES_PARADE_PRIORITY, b.speciesId)
        ? SPECIES_PARADE_PRIORITY[b.speciesId]
        : 99;
      if (pa !== pb) return pa - pb;
      return (a.uid || 0) - (b.uid || 0);
    });
  }

  class ParadeController {
    constructor(options = {}) {
      const opts = (options && typeof options === 'object') ? options : {};
      this.intervalSec = Number.isFinite(opts.intervalSec) && opts.intervalSec > 0
        ? opts.intervalSec
        : PARADE_INTERVAL_SEC;
      this.boostDurationSec = Number.isFinite(opts.boostDurationSec) && opts.boostDurationSec > 0
        ? opts.boostDurationSec
        : PARADE_BOOST_DURATION_SEC;
      this.boostMultiplier = Number.isFinite(opts.boostMultiplier) && opts.boostMultiplier >= 1
        ? opts.boostMultiplier
        : PARADE_BOOST_MULTIPLIER;
      this.spacingPx = Number.isFinite(opts.spacingPx) && opts.spacingPx > 12
        ? opts.spacingPx
        : PARADE_SPACING_PX;
      this.marchSpeedPx = Number.isFinite(opts.marchSpeedPx) && opts.marchSpeedPx > 10
        ? opts.marchSpeedPx
        : PARADE_MARCH_SPEED_PX;
      this.chimeIntervalSec = Number.isFinite(opts.chimeIntervalSec) && opts.chimeIntervalSec > 0.2
        ? opts.chimeIntervalSec
        : PARADE_CHIME_INTERVAL_SEC;

      this.countdownSec = this.intervalSec;
      this.phase = 'IDLE'; // 'IDLE' | 'GATHER' | 'MARCH'
      this.direction = 1; // 1 = left->right, -1 = right->left (alternates each parade)
      this.paradeCount = 0;
      this.gatherElapsedSec = 0;
      this.marchElapsedSec = 0;
      this.chimeTimerSec = 0;
      this.chimeStepIndex = 0;
      this.sparkleTimerSec = 0;
      this.participants = [];
      this.laneY = 320;
    }

    isActive() {
      return this.phase !== 'IDLE';
    }

    startParade(context = {}) {
      if (this.isActive()) return false;
      const penguins = Array.isArray(context.penguins) ? context.penguins : [];
      if (penguins.length === 0) return false;

      const width = (Number.isFinite(context.width) && context.width > 40) ? context.width : 360;
      const height = (Number.isFinite(context.height) && context.height > 100) ? context.height : 640;
      const visibleBottomY = Number.isFinite(context.visibleBottomY) ? context.visibleBottomY : height;

      this.paradeCount += 1;
      this.direction = (this.paradeCount % 2 === 1) ? 1 : -1;
      this.phase = 'GATHER';
      this.gatherElapsedSec = 0;
      this.marchElapsedSec = 0;
      this.chimeTimerSec = this.chimeIntervalSec * 0.7;
      this.chimeStepIndex = 0;
      this.sparkleTimerSec = 0;
      this.countdownSec = this.intervalSec;
      this.laneY = computeParadeLaneY(height, visibleBottomY);

      const ordered = sortPenguinsForParade(penguins);
      this.participants = ordered;

      const entryEdgeX = this.direction === 1 ? -PARADE_EDGE_MARGIN_PX : width + PARADE_EDGE_MARGIN_PX;

      ordered.forEach((p, idx) => {
        if (typeof context.releaseSlot === 'function') {
          context.releaseSlot(p.uid);
        }
        p.claimedTarget = null;
        p.speechText = null;
        p.speechTimer = 0;
        p.isStandingAtTalkSpot = false;
        p.isAtSleepSpot = false;
        p.sleepTimer = 0;
        p.departureDelay = 0;
        p.isSliding = false;
        p.happyTimer = Math.max(p.happyTimer || 0, 2.5);
        p.state = 'PARADE';
        p.paradeIndex = idx;
        p.isParadeLeader = idx === 0;
        p.paradeArrivedAtStaging = false;
        p.paradeStagingX = entryEdgeX - this.direction * (idx * this.spacingPx);
        p.facing = (entryEdgeX >= p.x) ? 1 : -1;
      });

      if (typeof context.onParadeStart === 'function') {
        context.onParadeStart({
          direction: this.direction,
          participantCount: ordered.length,
          boostDurationSec: this.boostDurationSec,
          boostMultiplier: this.boostMultiplier,
          paradeNumber: this.paradeCount
        });
      }
      return true;
    }

    /**
     * Enrolls a newly spawned penguin into an in-progress parade so every visible
     * penguin on screen marches in formation.
     */
    enrollPenguin(penguin, context = {}) {
      if (!this.isActive() || !penguin) return false;
      if (this.participants.includes(penguin)) return false;

      const width = (Number.isFinite(context.width) && context.width > 40) ? context.width : 360;
      const entryEdgeX = this.direction === 1 ? -PARADE_EDGE_MARGIN_PX : width + PARADE_EDGE_MARGIN_PX;

      if (typeof context.releaseSlot === 'function') {
        context.releaseSlot(penguin.uid);
      }
      const idx = this.participants.length;
      const tail = idx > 0 ? this.participants[idx - 1] : null;
      penguin.claimedTarget = null;
      penguin.speechText = null;
      penguin.speechTimer = 0;
      penguin.isStandingAtTalkSpot = false;
      penguin.isAtSleepSpot = false;
      penguin.sleepTimer = 0;
      penguin.departureDelay = 0;
      penguin.isSliding = false;
      penguin.happyTimer = 2.5;
      penguin.state = 'PARADE';
      penguin.paradeIndex = idx;
      penguin.isParadeLeader = idx === 0;

      if (this.phase === 'MARCH' && tail) {
        penguin.x = tail.x - this.direction * this.spacingPx;
        penguin.y = this.laneY;
        penguin.facing = this.direction;
        penguin.paradeArrivedAtStaging = true;
      } else {
        penguin.paradeArrivedAtStaging = false;
        penguin.paradeStagingX = entryEdgeX - this.direction * (idx * this.spacingPx);
      }

      this.participants.push(penguin);
      return true;
    }

    _beginMarch(width) {
      this.phase = 'MARCH';
      this.marchElapsedSec = 0;
      const startLeadX = this.direction === 1 ? -PARADE_EDGE_MARGIN_PX : width + PARADE_EDGE_MARGIN_PX;

      this.participants.forEach((p, idx) => {
        p.paradeIndex = idx;
        p.isParadeLeader = idx === 0;
        p.x = startLeadX - this.direction * (idx * this.spacingPx);
        p.y = this.laneY;
        p.facing = this.direction;
        p.isSliding = false;
        p.stepPhase = idx * 0.55;
        p.happyTimer = 2.0;
      });
    }

    finishParade(context = {}) {
      if (!this.isActive()) return;
      const width = (Number.isFinite(context.width) && context.width > 40) ? context.width : 360;
      const height = (Number.isFinite(context.height) && context.height > 100) ? context.height : 640;
      const minY = height * 0.42;
      const maxY = height * 0.86;
      const reEntryX = this.direction === 1 ? Math.max(24, width - 20) : Math.min(width - 24, 20);
      const returnFacing = -this.direction;

      const list = this.participants.slice();
      this.participants = [];
      this.phase = 'IDLE';
      this.gatherElapsedSec = 0;
      this.marchElapsedSec = 0;
      this.chimeTimerSec = 0;
      this.sparkleTimerSec = 0;

      list.forEach((p, idx) => {
        p.isParadeLeader = false;
        p.paradeIndex = -1;
        p.paradeArrivedAtStaging = false;
        p.x = reEntryX;
        const spreadOffset = ((idx % 5) - 2) * 14;
        p.y = Math.max(minY, Math.min(maxY, this.laneY + spreadOffset));
        p.facing = returnFacing;
        p.happyTimer = 1.6;
        p.departureDelay = Math.min(2.2, idx * 0.11);
        if (p.carriedFish > 0 && typeof p.initiatePathToDepot === 'function') {
          p.initiatePathToDepot();
        } else if (typeof p.initiatePathToFishingHole === 'function') {
          p.initiatePathToFishingHole();
        } else {
          p.state = 'WAITING_NEARBY';
        }
      });

      if (typeof context.onParadeEnd === 'function') {
        context.onParadeEnd({ paradeNumber: this.paradeCount });
      }
    }

    /**
     * Immediately stops any active parade (for Glacial Rebirth or Factory Reset)
     * and resets the 15-minute cadence cleanly.
     */
    cancelAndReset(penguins = []) {
      const seen = new Set();
      this.participants.forEach((p) => {
        if (p) {
          p.isParadeLeader = false;
          p.paradeIndex = -1;
          p.paradeArrivedAtStaging = false;
          if (p.state === 'PARADE') {
            p.state = 'WAITING_NEARBY';
          }
          seen.add(p);
        }
      });
      if (Array.isArray(penguins)) {
        penguins.forEach((p) => {
          if (p && !seen.has(p)) {
            p.isParadeLeader = false;
            p.paradeIndex = -1;
            p.paradeArrivedAtStaging = false;
            if (p.state === 'PARADE') {
              p.state = 'WAITING_NEARBY';
            }
          }
        });
      }
      this.participants = [];
      this.phase = 'IDLE';
      this.gatherElapsedSec = 0;
      this.marchElapsedSec = 0;
      this.chimeTimerSec = 0;
      this.chimeStepIndex = 0;
      this.sparkleTimerSec = 0;
      this.countdownSec = this.intervalSec;
    }

    update(dt, context = {}) {
      const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(0.25, dt)) : 0;
      if (safeDt <= 0) return { phase: this.phase, triggered: false, completed: false };

      const penguins = Array.isArray(context.penguins) ? context.penguins : [];
      const width = (Number.isFinite(context.width) && context.width > 40) ? context.width : 360;
      const height = (Number.isFinite(context.height) && context.height > 100) ? context.height : 640;
      const visibleBottomY = Number.isFinite(context.visibleBottomY) ? context.visibleBottomY : height;
      const isPaused = Boolean(context.isPaused);
      const isBlocked = Boolean(context.isBlocked);

      if (isPaused) {
        return { phase: this.phase, triggered: false, completed: false };
      }

      if (this.phase === 'IDLE') {
        if (isBlocked || penguins.length === 0) {
          return { phase: this.phase, triggered: false, completed: false };
        }
        this.countdownSec = Math.max(0, this.countdownSec - safeDt);
        if (this.countdownSec <= 0) {
          const started = this.startParade(context);
          return { phase: this.phase, triggered: started, completed: false };
        }
        return { phase: this.phase, triggered: false, completed: false };
      }

      // Prune any penguins removed externally while preserving leader role
      const activeSet = new Set(penguins);
      this.participants = this.participants.filter((p) => activeSet.has(p) && p.state === 'PARADE');
      if (this.participants.length === 0) {
        this.phase = 'IDLE';
        return { phase: this.phase, triggered: false, completed: true };
      }
      this.participants.forEach((p, idx) => {
        p.paradeIndex = idx;
        p.isParadeLeader = idx === 0;
      });

      // Dynamically keep parade lane visible on resize or bottom-sheet drag
      const targetLaneY = computeParadeLaneY(height, visibleBottomY);
      this.laneY += (targetLaneY - this.laneY) * Math.min(1, safeDt * 6);

      if (this.phase === 'GATHER') {
        this.gatherElapsedSec += safeDt;
        const entryEdgeX = this.direction === 1 ? -PARADE_EDGE_MARGIN_PX : width + PARADE_EDGE_MARGIN_PX;
        const gatherSpeed = Math.max(240, width * 0.85);
        let allArrived = true;

        for (let i = 0; i < this.participants.length; i++) {
          const p = this.participants[i];
          p.stepPhase = (p.stepPhase || 0) + safeDt * 11;
          p.happyTimer = Math.max(p.happyTimer || 0, 0.5);
          if (p.paradeArrivedAtStaging) continue;

          const dx = entryEdgeX - p.x;
          const dy = this.laneY - p.y;
          const dist = Math.hypot(dx, dy);
          const step = gatherSpeed * safeDt;
          if (dist <= step + 4) {
            p.x = entryEdgeX;
            p.y = this.laneY;
            p.paradeArrivedAtStaging = true;
          } else {
            p.x += (dx / dist) * step;
            p.y += (dy / dist) * step;
            p.facing = dx >= 0 ? 1 : -1;
            allArrived = false;
          }
        }

        if (allArrived || this.gatherElapsedSec >= PARADE_MAX_GATHER_SEC) {
          this._beginMarch(width);
        }
        return { phase: this.phase, triggered: false, completed: false };
      }

      if (this.phase === 'MARCH') {
        this.marchElapsedSec += safeDt;
        const moveStep = this.marchSpeedPx * safeDt * this.direction;
        const exitEdgeX = this.direction === 1 ? width + PARADE_EDGE_MARGIN_PX : -PARADE_EDGE_MARGIN_PX;
        let allExited = true;
        let anyOnScreen = false;

        for (let i = 0; i < this.participants.length; i++) {
          const p = this.participants[i];
          p.x += moveStep;
          // Gentle joyful wave along the parade lane
          p.y = this.laneY + Math.sin(this.marchElapsedSec * 3.4 + i * 0.7) * 2.2;
          p.facing = this.direction;
          p.stepPhase = (p.stepPhase || 0) + safeDt * 9.5;
          p.happyTimer = Math.max(p.happyTimer || 0, 0.5);

          if (p.x >= -10 && p.x <= width + 10) {
            anyOnScreen = true;
          }
          if (this.direction === 1 ? p.x < exitEdgeX : p.x > exitEdgeX) {
            allExited = false;
          }
        }

        // Play celebratory chimes periodically while penguins march across screen
        if (anyOnScreen) {
          this.chimeTimerSec -= safeDt;
          if (this.chimeTimerSec <= 0) {
            this.chimeTimerSec = this.chimeIntervalSec;
            if (typeof context.onParadeChime === 'function') {
              context.onParadeChime(this.chimeStepIndex);
            }
            this.chimeStepIndex += 1;
          }

          // Festive music note & sparkle emission along the marching line
          if (typeof context.onParadeSparkle === 'function') {
            this.sparkleTimerSec -= safeDt;
            if (this.sparkleTimerSec <= 0) {
              this.sparkleTimerSec = 0.36;
              const visibleMarchers = this.participants.filter((p) => p.x >= 16 && p.x <= width - 16);
              if (visibleMarchers.length > 0) {
                const chosen = visibleMarchers[this.chimeStepIndex % visibleMarchers.length] || visibleMarchers[0];
                context.onParadeSparkle(chosen, this.marchElapsedSec);
              }
            }
          }
        }

        if (allExited) {
          this.finishParade(context);
          return { phase: this.phase, triggered: false, completed: true };
        }
      }

      return { phase: this.phase, triggered: false, completed: false };
    }
  }

  return {
    PARADE_INTERVAL_SEC,
    PARADE_BOOST_DURATION_SEC,
    PARADE_BOOST_MULTIPLIER,
    PARADE_SPACING_PX,
    PARADE_MARCH_SPEED_PX,
    PARADE_CHIME_INTERVAL_SEC,
    computeParadeLaneY,
    sortPenguinsForParade,
    ParadeController
  };
});
