//! Original fixed-step combat prototype. Constants are design choices, not recovered timings.
#![forbid(unsafe_code)]

pub const WIDTH: f32 = 960.0;
pub const HEIGHT: f32 = 540.0;
pub const FLOOR: f32 = 466.0;
pub const STEP: f32 = 1.0 / 60.0;
pub const LEFT: u32 = 1;
pub const RIGHT: u32 = 2;
pub const JUMP: u32 = 4;
pub const ATTACK: u32 = 8;
pub const DODGE: u32 = 16;
pub const DOWN: u32 = 32;
mod castle;
pub use castle::*;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}
impl Rect {
    pub fn overlaps(self, other: Self) -> bool {
        self.x < other.x + other.w
            && self.x + self.w > other.x
            && self.y < other.y + other.h
            && self.y + self.h > other.y
    }
}

#[derive(Clone, Debug)]
pub struct Actor {
    pub rect: Rect,
    pub vx: f32,
    pub vy: f32,
    pub facing: f32,
    pub hp: i32,
    pub grounded: bool,
    pub attack: u16,
    pub dodge: u16,
    pub cooldown: u16,
    pub invulnerable: u16,
    pub ai: u16,
    pub hit: bool,
    pub combo: u8,
    pub kind: u32,
    pub max_hp: i32,
}
impl Actor {
    fn new(x: f32, hp: i32) -> Self {
        Self {
            rect: Rect {
                x,
                y: FLOOR - 40.0,
                w: 24.0,
                h: 40.0,
            },
            vx: 0.0,
            vy: 0.0,
            facing: 1.0,
            hp,
            grounded: true,
            attack: 0,
            dodge: 0,
            cooldown: 0,
            invulnerable: 0,
            ai: 0,
            hit: false,
            combo: 0,
            kind: 0,
            max_hp: hp,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Save {
    pub best: u32,
    pub cleared: u32,
}
impl Save {
    /// Schema zero had only a best score. Unknown schemas must not overwrite stored data.
    pub fn migrate(version: u32, best: u32, cleared: u32) -> Option<Self> {
        match version {
            0 => Some(Self { best, cleared: 0 }),
            1 => Some(Self { best, cleared }),
            _ => None,
        }
    }
}

#[derive(Clone, Debug)]
pub struct World {
    pub player: Actor,
    pub enemies: Vec<Actor>,
    pub platforms: Vec<Rect>,
    pub room: u32,
    pub score: u32,
    pub ticks: u32,
    pub seed: u32,
    pub events: u32,
    pub save: Save,
    pub room_id: usize,
    pub castle_seed: u32,
    pub rooms: Vec<Option<RoomState>>,
    pub history: Vec<usize>,
    pub seen: u32,
    pub cleared_mask: u32,
    pub next_exit: usize,
    pub loot: Vec<Loot>,
    pub hazards: Vec<Hazard>,
    pub chest_open: bool,
    pub shrine_used: bool,
    pub gold: u32,
    pub keys: u32,
    pub flasks: u32,
    pub max_hp: i32,
    pub weapon: u32,
    pub weapon_tier: u32,
    pub power: u32,
    pub skill_cooldown: u16,
    pub heal_cooldown: u16,
    pub won: bool,
    previous: u32,
    coyote: u16,
    jump_buffer: u16,
    attack_buffer: u16,
    combo_window: u16,
    drop_timer: u16,
}

fn random(seed: &mut u32) -> u32 {
    *seed ^= *seed << 13;
    *seed ^= *seed >> 17;
    *seed ^= *seed << 5;
    *seed
}

impl World {
    pub fn new(seed: u32, save: Save) -> Self {
        let mut world = Self {
            player: Actor::new(68.0, 5),
            enemies: Vec::new(),
            platforms: Vec::new(),
            room: 1,
            score: 0,
            ticks: 0,
            seed: seed.max(1),
            events: 0,
            save,
            room_id: 0,
            castle_seed: seed.max(1),
            rooms: vec![None; 9],
            history: Vec::new(),
            seen: 1,
            cleared_mask: 0,
            next_exit: 0,
            loot: Vec::new(),
            hazards: Vec::new(),
            chest_open: false,
            shrine_used: false,
            gold: 0,
            keys: 0,
            flasks: 2,
            max_hp: 5,
            weapon: 0,
            weapon_tier: 0,
            power: 0,
            skill_cooldown: 0,
            heal_cooldown: 0,
            won: false,
            previous: 0,
            coyote: 5,
            jump_buffer: 0,
            attack_buffer: 0,
            combo_window: 0,
            drop_timer: 0,
        };
        world.generate();
        world
    }

    fn generate(&mut self) {
        castle::populate(self);
        self.player.rect.x = 68.0;
        self.player.rect.y = FLOOR - 40.0;
        self.player.vx = 0.0;
        self.player.vy = 0.0;
        self.player.attack = 0;
        self.player.dodge = 0;
        self.player.grounded = true;
        self.jump_buffer = 0;
        self.attack_buffer = 0;
        self.combo_window = 0;
        self.drop_timer = 0;
    }

    pub fn cleared(&self) -> bool {
        self.enemies.iter().all(|e| e.hp <= 0)
    }

    pub fn release_input(&mut self) {
        self.previous = 0;
        self.jump_buffer = 0;
        self.attack_buffer = 0;
    }

    pub fn step(&mut self, input: u32) {
        self.events = 0;
        if self.player.hp <= 0 || self.won {
            return;
        }
        self.ticks = self.ticks.wrapping_add(1);
        let pressed = input & !self.previous;
        self.previous = input;
        self.castle_actions(pressed);
        let damage = self.weapon_damage();
        let base_duration = self.weapon_duration();
        let reach = self.weapon_reach();
        let mut deaths = Vec::new();
        self.jump_buffer = if pressed & JUMP != 0 {
            7
        } else {
            self.jump_buffer.saturating_sub(1)
        };
        self.attack_buffer = if pressed & ATTACK != 0 {
            10
        } else {
            self.attack_buffer.saturating_sub(1)
        };
        self.combo_window = self.combo_window.saturating_sub(1);
        self.drop_timer = self.drop_timer.saturating_sub(1);
        let p = &mut self.player;
        p.invulnerable = p.invulnerable.saturating_sub(1);
        p.cooldown = p.cooldown.saturating_sub(1);
        p.dodge = p.dodge.saturating_sub(1);
        p.attack = p.attack.saturating_sub(1);
        if p.grounded {
            self.coyote = 6;
        } else {
            self.coyote = self.coyote.saturating_sub(1);
        }
        let direction = u8::from(input & RIGHT != 0) as f32 - u8::from(input & LEFT != 0) as f32;
        if direction != 0.0 && p.dodge == 0 {
            p.facing = direction;
        }
        let recovery_threshold = base_duration + if p.combo == 3 { 6 } else { 0 } - 12;
        if pressed & DODGE != 0 && p.cooldown == 0 && p.attack <= recovery_threshold {
            p.dodge = 16;
            p.cooldown = 48;
            p.invulnerable = 16;
            p.attack = 0;
            self.attack_buffer = 0;
            self.events |= 4;
        }
        if self.jump_buffer > 0
            && input & DOWN != 0
            && p.grounded
            && p.rect.y + p.rect.h < FLOOR - 1.0
        {
            self.drop_timer = 12;
            self.jump_buffer = 0;
            self.coyote = 0;
            p.rect.y += 3.0;
            p.vy = 100.0;
            p.grounded = false;
        }
        if self.jump_buffer > 0 && self.coyote > 0 && p.dodge == 0 {
            p.vy = -760.0;
            p.grounded = false;
            self.coyote = 0;
            self.jump_buffer = 0;
            self.events |= 1;
        }
        if input & JUMP == 0 && p.vy < -300.0 {
            p.vy = -300.0;
        }
        if self.attack_buffer > 0 && p.attack == 0 && p.dodge == 0 {
            p.combo = if self.combo_window > 0 {
                p.combo % 3 + 1
            } else {
                1
            };
            p.attack = base_duration + if p.combo == 3 { 6 } else { 0 };
            self.combo_window = 55;
            self.attack_buffer = 0;
            self.events |= 2;
            for enemy in &mut self.enemies {
                enemy.hit = false;
            }
        }
        let attack_length = base_duration + if p.combo == 3 { 6 } else { 0 };
        let active = (attack_length - 11..=attack_length - 6).contains(&p.attack);
        p.vx = if p.dodge > 0 {
            p.facing * 640.0
        } else {
            let target = if active && direction == 0.0 {
                p.facing * 75.0
            } else {
                direction * if p.attack > 0 { 145.0 } else { 260.0 }
            };
            let acceleration = if p.grounded { 3200.0 } else { 2400.0 };
            p.vx + (target - p.vx).clamp(-acceleration * STEP, acceleration * STEP)
        };
        move_actor(p, &self.platforms, self.drop_timer > 0);
        let slash = Rect {
            x: if p.facing > 0.0 {
                p.rect.x + p.rect.w
            } else {
                p.rect.x - reach
            },
            y: p.rect.y - 4.0,
            w: reach,
            h: 48.0,
        };
        for enemy in &mut self.enemies {
            if enemy.hp <= 0 {
                continue;
            }
            if active && !enemy.hit && slash.overlaps(enemy.rect) {
                enemy.hp -= damage * if p.combo == 3 { 2 } else { 1 };
                enemy.hit = true;
                enemy.invulnerable = 12;
                enemy.rect.x = (enemy.rect.x + p.facing * 22.0).clamp(0.0, WIDTH - enemy.rect.w);
                self.events |= 8;
                if enemy.hp <= 0 {
                    deaths.push((enemy.rect.x, enemy.rect.y, enemy.kind));
                    continue;
                }
            }
            enemy.invulnerable = enemy.invulnerable.saturating_sub(1);
            enemy.cooldown = enemy.cooldown.saturating_sub(1);
            let dx = p.rect.x - enemy.rect.x;
            if enemy.attack == 0 {
                enemy.facing = if dx < 0.0 { -1.0 } else { 1.0 };
                enemy.vx = if dx.abs() > 42.0 {
                    enemy.facing
                        * match enemy.kind {
                            1 => 115.0,
                            2 => 58.0,
                            3 if enemy.hp < enemy.max_hp / 2 => 105.0,
                            3 => 72.0,
                            _ => 72.0,
                        }
                } else {
                    0.0
                };
                if dx.abs() < 95.0 && (p.rect.y - enemy.rect.y).abs() < 50.0 && enemy.cooldown == 0
                {
                    enemy.attack = 50;
                    enemy.vx = 0.0;
                }
            } else {
                enemy.attack -= 1;
                enemy.vx = if (12..=22).contains(&enemy.attack) {
                    enemy.facing * 300.0
                } else {
                    0.0
                };
                if enemy.attack == 0 {
                    enemy.cooldown = if enemy.kind == 3 && enemy.hp < enemy.max_hp / 2 {
                        22
                    } else {
                        45
                    };
                }
            }
            move_actor(enemy, &self.platforms, false);
            if (12..=22).contains(&enemy.attack)
                && enemy.rect.overlaps(p.rect)
                && p.invulnerable == 0
            {
                p.hp -= if enemy.kind >= 2 { 2 } else { 1 };
                p.invulnerable = 70;
                self.events |= 32;
                if p.hp == 0 {
                    self.events |= 64;
                }
            }
        }
        for (x, y, kind) in deaths {
            self.reward_kill(x, y, kind);
        }
        self.finish_castle_tick(pressed);
        self.save.best = self.save.best.max(self.score);
    }
}

fn move_actor(actor: &mut Actor, platforms: &[Rect], drop_through: bool) {
    actor.rect.x = (actor.rect.x + actor.vx * STEP).clamp(12.0, WIDTH - actor.rect.w - 12.0);
    let old_bottom = actor.rect.y + actor.rect.h;
    actor.vy = (actor.vy + 1450.0 * STEP).min(900.0);
    actor.rect.y += actor.vy * STEP;
    actor.grounded = false;
    // Platforms are one-way by design. Resolve the earliest crossed top.
    if actor.vy >= 0.0 {
        let landing = platforms
            .iter()
            .filter(|tile| {
                (!drop_through || tile.y >= FLOOR)
                    && actor.rect.x < tile.x + tile.w
                    && actor.rect.x + actor.rect.w > tile.x
                    && old_bottom <= tile.y + 0.1
                    && actor.rect.y + actor.rect.h >= tile.y
            })
            .map(|tile| tile.y)
            .min_by(f32::total_cmp);
        if let Some(y) = landing {
            actor.rect.y = y - actor.rect.h;
            actor.vy = 0.0;
            actor.grounded = true;
        }
    }
}

/// Shared native/browser regression suite. Returns completed assertion count.
pub fn regression_suite() -> u32 {
    let mut count = 0;
    let save = Save {
        best: 600,
        cleared: 2,
    };
    assert_eq!(
        Save::migrate(0, 600, 99),
        Some(Save {
            best: 600,
            cleared: 0
        })
    );
    count += 1;
    assert_eq!(Save::migrate(1, 600, 2), Some(save));
    count += 1;
    assert_eq!(Save::migrate(2, 0, 0), None);
    count += 1;
    let mut world = World::new(123, save);
    assert_eq!(world.platforms, World::new(123, save).platforms);
    count += 1;
    assert_ne!(world.platforms, World::new(124, save).platforms);
    count += 1;
    world.enemies.clear();
    for _ in 0..30 {
        world.step(RIGHT);
    }
    assert!((world.player.rect.x - 190.0).abs() < 3.0);
    count += 1;
    world.step(JUMP);
    assert!(world.player.vy < 0.0);
    count += 1;
    for _ in 0..100 {
        world.step(0);
    }
    assert!(world.player.grounded && world.player.rect.y + world.player.rect.h <= FLOOR + 0.1);
    count += 1;
    world.step(DODGE);
    assert_eq!(world.player.dodge, 16);
    count += 1;
    world.step(0);
    world.step(DODGE);
    assert_eq!(world.player.dodge, 14);
    count += 1;
    world = World::new(8, save);
    world.enemies = vec![Actor::new(110.0, 3)];
    world.step(ATTACK);
    for _ in 0..26 {
        world.step(0);
    }
    assert_eq!(world.enemies[0].hp, 2);
    count += 1;
    world.enemies[0].hp = 0;
    world.player.rect.x = 901.0;
    world.step(0);
    assert_eq!(world.room, 2);
    count += 1;
    assert_eq!(world.save.cleared, 3);
    count += 1;
    world.player.hp = 0;
    let position = world.player.rect;
    world.step(RIGHT | JUMP);
    assert_eq!(world.player.rect, position);
    count += 1;
    count
}

/// Control-feel regressions executed against the same WASM used by the game.
pub fn controls_suite() -> u32 {
    let blank = || {
        let mut w = World::new(33, Save::default());
        w.enemies.clear();
        w
    };
    let apex = |hold: u32| {
        let mut w = blank();
        let mut top = w.player.rect.y;
        for frame in 0..100 {
            w.step(if frame < hold { JUMP } else { 0 });
            top = top.min(w.player.rect.y);
        }
        top
    };
    assert!(apex(24) + 90.0 < apex(1));
    let mut w = blank();
    w.platforms.truncate(1);
    w.player.rect.y = FLOOR - 46.0;
    w.player.vy = 150.0;
    w.player.grounded = false;
    w.coyote = 0;
    w.step(JUMP);
    w.step(0);
    w.step(0);
    assert!(w.events & 1 != 0 && w.player.vy < 0.0);
    w = blank();
    w.player.rect.x = 321.0;
    w.player.rect.y = 300.0;
    w.platforms = vec![Rect {
        x: 200.0,
        y: 340.0,
        w: 120.0,
        h: 16.0,
    }];
    w.step(RIGHT);
    w.step(JUMP);
    assert!(w.player.vy < 0.0);
    w = blank();
    w.player.attack = 10;
    w.step(DODGE);
    assert!(w.player.attack == 0 && w.player.dodge == 16 && w.player.invulnerable == 16);
    w = blank();
    w.player.attack = 4;
    w.player.combo = 1;
    w.combo_window = 30;
    w.step(ATTACK);
    for _ in 0..3 {
        w.step(0);
    }
    assert!(w.player.attack == 26 && w.player.combo == 2);
    w = blank();
    w.step(RIGHT);
    assert!(w.player.vx > 0.0 && w.player.vx < 260.0);
    for _ in 0..10 {
        w.step(RIGHT);
    }
    w.step(0);
    assert!(w.player.vx > 0.0 && w.player.vx < 260.0);
    w = blank();
    w.platforms.push(Rect {
        x: 0.0,
        y: 330.0,
        w: 200.0,
        h: 16.0,
    });
    w.player.rect.y = 290.0;
    w.step(DOWN | JUMP);
    for _ in 0..14 {
        w.step(0);
    }
    assert!(w.player.rect.y + w.player.rect.h > 350.0 && w.player.vy > 0.0);
    w = blank();
    w.weapon = 2;
    w.player.attack = 12;
    w.step(DODGE);
    assert_eq!(
        w.player.dodge, 0,
        "a dagger's active strike cannot be cancelled as recovery"
    );
    w.step(0);
    w.player.attack = 5;
    w.step(DODGE);
    assert_eq!(w.player.dodge, 16);
    8
}

#[cfg(test)]
mod tests {
    #[test]
    fn gameplay_and_save_regressions() {
        assert_eq!(super::regression_suite(), 14);
    }
}
