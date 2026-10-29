//! Original castle traversal, loot and encounter rules. No installed game code is used.
use super::*;

pub const INTERACT: u32 = 64;
pub const HEAL: u32 = 128;
pub const SKILL: u32 = 256;
pub const LOOT_EVENT: u32 = 512;
pub const CHEST_EVENT: u32 = 1024;
pub const EQUIP_EVENT: u32 = 2048;
pub const HEAL_EVENT: u32 = 4096;
pub const SKILL_EVENT: u32 = 8192;
pub const UPGRADE_EVENT: u32 = 16384;
pub const DENIED_EVENT: u32 = 32768;
pub const WIN_EVENT: u32 = 65536;
pub const CLEAR_EVENT: u32 = 131072;
pub const EXITS: [&[usize]; 9] = [&[1, 2], &[3], &[3], &[4], &[5, 6], &[7], &[7], &[8], &[]];
pub const THEMES: [u32; 9] = [0, 1, 2, 0, 0, 0, 2, 1, 1];

#[derive(Clone, Debug)]
pub struct Loot {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    /// 0 gold, 1 healing, 2 weapon, 3 power scroll, 4 key.
    pub kind: u32,
    pub amount: u32,
    pub rarity: u32,
    pub active: bool,
}
impl Loot {
    pub fn new(x: f32, y: f32, kind: u32, amount: u32, rarity: u32) -> Self {
        Self {
            x,
            y,
            vx: 0.0,
            vy: -110.0,
            kind,
            amount,
            rarity,
            active: true,
        }
    }
}
#[derive(Clone, Debug)]
pub struct Hazard {
    pub x: f32,
    pub w: f32,
    pub phase: u32,
}
#[derive(Clone, Debug)]
pub struct RoomState {
    enemies: Vec<Actor>,
    platforms: Vec<Rect>,
    loot: Vec<Loot>,
    hazards: Vec<Hazard>,
    chest_open: bool,
    shrine_used: bool,
}

pub(crate) fn populate(world: &mut World) {
    let id = world.room_id;
    if let Some(saved) = world.rooms[id].clone() {
        world.enemies = saved.enemies;
        world.platforms = saved.platforms;
        world.loot = saved.loot;
        world.hazards = saved.hazards;
        world.chest_open = saved.chest_open;
        world.shrine_used = saved.shrine_used;
        return;
    }
    world.platforms = vec![Rect {
        x: 0.0,
        y: FLOOR,
        w: WIDTH,
        h: HEIGHT - FLOOR,
    }];
    let layouts: &[&[(f32, f32, f32)]] = &[
        &[
            (180.0, 340.0, 120.0),
            (420.0, 314.0, 120.0),
            (660.0, 340.0, 120.0),
        ],
        &[
            (150.0, 364.0, 150.0),
            (380.0, 320.0, 130.0),
            (610.0, 288.0, 160.0),
            (800.0, 360.0, 85.0),
        ],
        &[(140.0, 340.0, 230.0), (570.0, 340.0, 230.0)],
        &[(130.0, 350.0, 220.0), (590.0, 350.0, 220.0)],
        &[
            (140.0, 364.0, 100.0),
            (300.0, 312.0, 110.0),
            (470.0, 346.0, 130.0),
            (680.0, 288.0, 150.0),
        ],
        &[(180.0, 340.0, 170.0), (600.0, 340.0, 170.0)],
        &[
            (160.0, 340.0, 150.0),
            (420.0, 304.0, 150.0),
            (690.0, 340.0, 150.0),
        ],
        &[(170.0, 350.0, 150.0), (640.0, 350.0, 150.0)],
        &[],
    ];
    let mut rng = world.castle_seed ^ (id as u32 + 1).wrapping_mul(0x9e37_79b9);
    for &(x, y, w) in layouts[id] {
        let jitter = (random(&mut rng) % 19) as f32;
        world.platforms.push(Rect {
            x: x + jitter,
            y,
            w,
            h: 16.0,
        });
    }
    world.enemies = match id {
        3 | 5 | 8 => vec![],
        0 => vec![enemy(390.0, 0), enemy(590.0, 1)],
        1 => vec![enemy(420.0, 2), enemy(680.0, 1)],
        2 => vec![enemy(380.0, 1), enemy(560.0, 0), enemy(750.0, 2)],
        4 => vec![enemy(390.0, 0), enemy(570.0, 2), enemy(760.0, 1)],
        6 => vec![enemy(420.0, 2), enemy(680.0, 2)],
        7 => vec![enemy(620.0, 3)],
        _ => vec![],
    };
    world.loot = Vec::new();
    world.hazards = if id == 2 || id == 6 {
        vec![
            Hazard {
                x: 435.0,
                w: 62.0,
                phase: 0,
            },
            Hazard {
                x: 820.0,
                w: 52.0,
                phase: 80,
            },
        ]
    } else {
        vec![]
    };
    world.chest_open = matches!(id, 5 | 7 | 8);
    world.shrine_used = false;
}
fn enemy(x: f32, kind: u32) -> Actor {
    let hp = match kind {
        1 => 2,
        2 => 7,
        3 => 28,
        _ => 3,
    };
    let mut actor = Actor::new(x, hp);
    actor.kind = kind;
    actor.max_hp = hp;
    if kind == 3 {
        actor.rect.w = 40.0;
        actor.rect.h = 60.0;
        actor.rect.y = FLOOR - 60.0;
    }
    if kind == 2 {
        actor.rect.w = 30.0;
        actor.rect.h = 46.0;
        actor.rect.y = FLOOR - 46.0;
    }
    actor
}

/// Stateful regressions for loot, resource consumption, branching and room caching.
pub fn castle_suite() -> u32 {
    let mut count = 0;
    let make = || World::new(77, Save::default());
    let mut w = make();
    w.enemies.clear();
    w.loot.push(Loot::new(150.0, FLOOR - 20.0, 0, 25, 0));
    for _ in 0..40 {
        w.step(0);
    }
    assert_eq!(w.gold, 25);
    count += 1;
    let n = w.loot.len();
    for _ in 0..20 {
        w.step(0);
    }
    assert_eq!((w.gold, w.loot.len()), (25, n));
    count += 1;
    w = make();
    w.step(HEAL);
    assert_eq!(w.flasks, 2);
    count += 1;
    w.player.hp = 1;
    w.step(0);
    w.step(HEAL);
    assert_eq!((w.player.hp, w.flasks), (4, 1));
    count += 1;
    w.step(0);
    w.step(HEAL);
    assert_eq!(w.flasks, 1);
    count += 1;
    w = make();
    w.player.rect.x = 700.0;
    w.step(INTERACT);
    assert!(!w.chest_open);
    count += 1;
    for enemy in &mut w.enemies {
        enemy.hp = 0;
    }
    w.step(0);
    w.step(INTERACT);
    assert!(w.chest_open && w.loot.iter().any(|d| d.kind == 2 && d.rarity == 1));
    count += 1;
    let n = w.loot.len();
    for _ in 0..10 {
        w.step(INTERACT);
    }
    assert_eq!(w.loot.len(), n);
    count += 1;
    w = make();
    w.enemies.clear();
    w.loot.push(Loot::new(80.0, FLOOR - 18.0, 2, 1, 2));
    w.step(INTERACT);
    assert_eq!((w.weapon, w.weapon_tier, w.weapon_damage()), (1, 2, 4));
    count += 1;
    w.loot.push(Loot::new(80.0, FLOOR - 20.0, 3, 1, 0));
    w.step(0);
    assert_eq!(w.weapon_damage(), 5);
    count += 1;
    assert!(!w.choose_exit(9));
    assert_eq!(w.next_exit, 0);
    count += 1;
    w.chest_open = true;
    w.choose_exit(1);
    w.player.rect.x = 901.0;
    w.step(0);
    assert_eq!(w.room_id, 2);
    count += 1;
    assert_eq!(THEMES[w.room_id], 2);
    assert_eq!(w.hazards.len(), 2);
    count += 1;
    w.enter_room(0, true);
    assert!(w.enemies.iter().all(|e| e.hp == 0) && w.chest_open);
    w.player.rect.x = 20.0;
    w.loot.push(Loot::new(25.0, FLOOR - 20.0, 2, 0, 0));
    assert_eq!(
        w.interaction(),
        6,
        "gear near a return door must not prevent backtracking"
    );
    count += 1;
    w.enter_room(6, false);
    for e in &mut w.enemies {
        e.hp = 0;
    }
    w.player.rect.x = 700.0;
    w.step(0);
    w.step(INTERACT);
    assert!(!w.chest_open && w.events & DENIED_EVENT != 0);
    count += 1;
    w.keys = 1;
    w.step(0);
    w.step(INTERACT);
    assert!(w.chest_open && w.keys == 0 && w.loot.iter().any(|d| d.rarity == 3));
    count += 1;
    w.enter_room(3, false);
    w.player.rect.x = 338.0;
    w.gold = 35;
    w.step(0);
    w.step(INTERACT);
    assert_eq!((w.max_hp, w.gold), (6, 0));
    count += 1;
    w.enter_room(5, false);
    w.player.rect.x = 338.0;
    w.flasks = 0;
    w.player.hp = 1;
    w.step(0);
    w.step(INTERACT);
    assert_eq!((w.player.hp, w.flasks), (6, 2));
    w.player.hp = 2;
    w.flasks = 0;
    w.step(0);
    w.step(INTERACT);
    assert_eq!(
        (w.player.hp, w.flasks),
        (2, 0),
        "sanctuary refills only once per run"
    );
    count += 1;
    w = make();
    w.player.rect.x = 380.0;
    w.step(SKILL);
    assert_eq!(w.skill_cooldown, 300);
    assert!(w.loot.iter().any(|d| d.kind == 0));
    count += 1;
    let n = w.loot.len();
    w.step(0);
    w.step(SKILL);
    assert_eq!(w.loot.len(), n);
    count += 1;
    w = make();
    w.enter_room(2, false);
    w.enemies.clear();
    w.ticks = 149;
    w.player.rect.x = 450.0;
    w.player.invulnerable = 0;
    w.step(0);
    assert_eq!(w.player.hp, 4);
    w.step(0);
    assert_eq!(w.player.hp, 4);
    count += 1;
    w = make();
    w.enter_room(7, false);
    assert_eq!(w.enemies[0].max_hp, 28);
    w.enemies[0].hp = 1;
    w.player.rect.x = 600.0;
    w.step(SKILL);
    assert!(w.cleared());
    count += 1;
    w.player.rect.x = 901.0;
    w.step(0);
    assert!(w.won && w.room_id == 8 && w.score >= 2000);
    count += 1;
    for seed in 1..20 {
        let mut run = World::new(seed, Save::default());
        for next in [2, 3, 4, 6, 7, 8] {
            let choice = run
                .exits()
                .iter()
                .position(|&id| id == next)
                .expect("castle route must connect");
            run.enemies.clear();
            run.choose_exit(choice);
            run.player.rect.x = 901.0;
            run.step(0);
            assert_eq!(run.room_id, next);
            for platform in &run.platforms {
                assert!(
                    platform.x >= 0.0 && platform.x + platform.w <= WIDTH && platform.y <= FLOOR
                );
            }
        }
        assert!(run.won);
    }
    count += 1;
    count
}

impl World {
    pub fn exits(&self) -> &'static [usize] {
        EXITS[self.room_id]
    }
    pub fn choose_exit(&mut self, index: usize) -> bool {
        if index < self.exits().len() {
            self.next_exit = index;
            true
        } else {
            false
        }
    }
    pub fn interaction(&self) -> u32 {
        let center = self.player.rect.x + 12.0;
        // An old weapon near the return door must never trap the player in a swap loop.
        if center < 65.0 && !self.history.is_empty() && self.cleared() {
            return 6;
        }
        if self.loot.iter().any(|drop| {
            drop.active
                && drop.kind == 2
                && (drop.x - center).abs() < 62.0
                && (drop.y - self.player.rect.y - 20.0).abs() < 65.0
        }) {
            return 1;
        }
        if !self.chest_open && (center - 720.0).abs() < 76.0 && self.player.grounded {
            return if self.cleared() { 2 } else { 7 };
        }
        if self.room_id == 3
            && !self.shrine_used
            && (center - 350.0).abs() < 75.0
            && self.player.grounded
        {
            return 3;
        }
        if self.room_id == 5
            && !self.shrine_used
            && (center - 350.0).abs() < 75.0
            && self.player.grounded
        {
            return 4;
        }
        if center > 830.0 && self.cleared() && !self.exits().is_empty() {
            return 5;
        }
        0
    }
    pub fn nearby_weapon(&self) -> Option<&Loot> {
        let center = self.player.rect.x + 12.0;
        self.loot
            .iter()
            .filter(|drop| {
                drop.active
                    && drop.kind == 2
                    && (drop.x - center).abs() < 62.0
                    && (drop.y - self.player.rect.y - 20.0).abs() < 65.0
            })
            .min_by(|a, b| (a.x - center).abs().total_cmp(&(b.x - center).abs()))
    }
    pub fn weapon_damage(&self) -> i32 {
        1 + self.weapon_tier as i32 + self.power.min(6) as i32 + i32::from(self.weapon == 1)
    }
    pub fn weapon_duration(&self) -> u16 {
        match self.weapon {
            1 => 34,
            2 => 18,
            _ => 26,
        }
    }
    pub fn weapon_reach(&self) -> f32 {
        match self.weapon {
            1 => 104.0,
            2 => 50.0,
            _ => 64.0,
        }
    }
    pub(crate) fn castle_actions(&mut self, pressed: u32) {
        self.skill_cooldown = self.skill_cooldown.saturating_sub(1);
        self.heal_cooldown = self.heal_cooldown.saturating_sub(1);
        if pressed & HEAL != 0 {
            if self.flasks > 0 && self.player.hp < self.max_hp && self.heal_cooldown == 0 {
                self.flasks -= 1;
                self.player.hp = (self.player.hp + 3).min(self.max_hp);
                self.heal_cooldown = 60;
                self.events |= HEAL_EVENT;
            } else {
                self.events |= DENIED_EVENT;
            }
        }
        if pressed & SKILL != 0 && self.skill_cooldown == 0 {
            self.skill_cooldown = 300;
            self.player.invulnerable = self.player.invulnerable.max(12);
            self.events |= SKILL_EVENT;
            let damage = self.weapon_damage() + 2;
            let center = self.player.rect.x + 12.0;
            let mut drops = Vec::new();
            for enemy in &mut self.enemies {
                if enemy.hp > 0
                    && (enemy.rect.x - center).abs() < 170.0
                    && (enemy.rect.y - self.player.rect.y).abs() < 90.0
                {
                    enemy.hp -= damage;
                    enemy.attack = 0;
                    enemy.cooldown = 60;
                    enemy.invulnerable = 14;
                    self.events |= 8;
                    if enemy.hp <= 0 {
                        drops.push((enemy.rect.x, enemy.rect.y, enemy.kind));
                    }
                }
            }
            for (x, y, kind) in drops {
                self.reward_kill(x, y, kind);
            }
        }
    }
    pub(crate) fn reward_kill(&mut self, x: f32, y: f32, kind: u32) {
        self.score = self
            .score
            .saturating_add(if kind == 3 { 1000 } else { 100 });
        self.events |= 16;
        let amount = if kind == 3 {
            100
        } else {
            12 + random(&mut self.seed) % 9
        };
        self.loot.push(Loot::new(x + 12.0, y + 20.0, 0, amount, 0));
        if kind >= 2 {
            self.loot.push(Loot::new(x - 10.0, y + 10.0, 4, 1, 0));
        }
        if self.player.hp < self.max_hp && random(&mut self.seed).is_multiple_of(3) {
            self.loot.push(Loot::new(x + 30.0, y, 1, 2, 0));
        }
    }
    fn save_room(&mut self) {
        self.rooms[self.room_id] = Some(RoomState {
            enemies: self.enemies.clone(),
            platforms: self.platforms.clone(),
            loot: self.loot.clone(),
            hazards: self.hazards.clone(),
            chest_open: self.chest_open,
            shrine_used: self.shrine_used,
        });
    }
    fn enter_room(&mut self, next: usize, back: bool) {
        self.save_room();
        if !back {
            self.history.push(self.room_id);
        }
        self.room_id = next;
        self.room = next as u32 + 1;
        self.seen |= 1 << next;
        self.next_exit = 0;
        self.generate();
        if back {
            self.player.rect.x = 840.0;
        }
        self.player.invulnerable = 35;
        self.events |= 128;
        if next == 8 {
            self.won = true;
            self.score = self.score.saturating_add(1000);
            self.events |= WIN_EVENT;
        }
    }
    pub(crate) fn finish_castle_tick(&mut self, pressed: u32) {
        if self.player.hp <= 0 {
            self.events |= 64;
            return;
        }
        let hero = self.player.rect;
        for drop in &mut self.loot {
            if !drop.active {
                continue;
            }
            drop.vy = (drop.vy + 900.0 * STEP).min(400.0);
            drop.y += drop.vy * STEP;
            drop.x = (drop.x + drop.vx * STEP).clamp(20.0, 940.0);
            let landing = self
                .platforms
                .iter()
                .filter(|p| {
                    drop.x >= p.x
                        && drop.x <= p.x + p.w
                        && drop.y - drop.vy * STEP <= p.y - 8.0
                        && drop.y >= p.y - 8.0
                })
                .map(|p| p.y - 8.0)
                .min_by(f32::total_cmp);
            if let Some(y) = landing {
                drop.y = y;
                drop.vy = 0.0;
            }
            let dx = hero.x + 12.0 - drop.x;
            let dy = hero.y + 20.0 - drop.y;
            let distance = dx.hypot(dy);
            if drop.kind != 2 && distance < 110.0 {
                drop.x += dx * 0.18;
                drop.y += dy * 0.18;
            }
            if distance < 28.0 && drop.kind != 2 {
                let picked = match drop.kind {
                    0 => {
                        self.gold = self.gold.saturating_add(drop.amount);
                        true
                    }
                    1 if self.player.hp < self.max_hp => {
                        self.player.hp = (self.player.hp + drop.amount as i32).min(self.max_hp);
                        self.events |= HEAL_EVENT;
                        true
                    }
                    3 => {
                        self.power = (self.power + 1).min(6);
                        self.events |= UPGRADE_EVENT;
                        true
                    }
                    4 => {
                        self.keys = self.keys.saturating_add(drop.amount);
                        true
                    }
                    _ => false,
                };
                if picked {
                    drop.active = false;
                    self.events |= LOOT_EVENT;
                }
            }
        }
        for hazard in &self.hazards {
            let phase = (self.ticks + hazard.phase) % 180;
            if phase >= 150
                && self.player.invulnerable == 0
                && hero.overlaps(Rect {
                    x: hazard.x,
                    y: FLOOR - 58.0,
                    w: hazard.w,
                    h: 58.0,
                })
            {
                self.player.hp -= 1;
                self.player.invulnerable = 70;
                self.events |= 32;
            }
        }
        if self.player.hp <= 0 {
            self.events |= 64;
            return;
        }
        if self.cleared() && self.cleared_mask & (1 << self.room_id) == 0 {
            self.cleared_mask |= 1 << self.room_id;
            self.save.cleared = self.save.cleared.saturating_add(1);
            self.events |= CLEAR_EVENT;
        }
        if pressed & INTERACT != 0 {
            self.interact();
        }
        if self.player.rect.x > 890.0 && self.cleared() && !self.exits().is_empty() {
            let next = self.exits()[self.next_exit];
            self.enter_room(next, false);
        }
    }
    fn interact(&mut self) {
        match self.interaction() {
            1 => {
                let center = self.player.rect.x + 12.0;
                let selected = self
                    .loot
                    .iter()
                    .enumerate()
                    .filter(|(_, d)| {
                        d.active
                            && d.kind == 2
                            && (d.x - center).abs() < 62.0
                            && (d.y - self.player.rect.y - 20.0).abs() < 65.0
                    })
                    .min_by(|(_, a), (_, b)| (a.x - center).abs().total_cmp(&(b.x - center).abs()))
                    .map(|(i, _)| i);
                if let Some(i) = selected {
                    let item = self.loot[i].clone();
                    self.loot[i].active = false;
                    self.loot.push(Loot::new(
                        (center - 48.0).max(20.0),
                        self.player.rect.y,
                        2,
                        self.weapon,
                        self.weapon_tier,
                    ));
                    self.weapon = item.amount.min(2);
                    self.weapon_tier = item.rarity.min(3);
                    self.player.attack = 0;
                    self.attack_buffer = 0;
                    self.events |= EQUIP_EVENT;
                }
            }
            2 => {
                if self.room_id == 6 {
                    if self.keys == 0 {
                        self.events |= DENIED_EVENT;
                        return;
                    }
                    self.keys -= 1;
                }
                self.chest_open = true;
                let tier = if self.room_id == 6 {
                    3
                } else if self.room_id >= 3 {
                    2
                } else {
                    1
                };
                let weapon = if self.room_id == 0 {
                    1
                } else {
                    random(&mut self.seed) % 3
                };
                self.loot
                    .push(Loot::new(705.0, FLOOR - 30.0, 2, weapon, tier));
                self.loot
                    .push(Loot::new(745.0, FLOOR - 30.0, 0, 20 + tier * 10, 0));
                self.loot.push(Loot::new(765.0, FLOOR - 30.0, 3, 1, 0));
                self.events |= CHEST_EVENT;
            }
            3 => {
                if self.gold >= 35 {
                    self.gold -= 35;
                    self.max_hp = (self.max_hp + 1).min(8);
                    self.player.hp = (self.player.hp + 2).min(self.max_hp);
                    self.shrine_used = true;
                    self.events |= UPGRADE_EVENT;
                } else {
                    self.events |= DENIED_EVENT;
                }
            }
            4 => {
                self.flasks = 2;
                self.player.hp = self.max_hp;
                self.shrine_used = true;
                self.events |= HEAL_EVENT;
            }
            5 => {
                let next = self.exits()[self.next_exit];
                self.enter_room(next, false);
            }
            6 => {
                if let Some(previous) = self.history.pop() {
                    self.enter_room(previous, true);
                }
            }
            _ => {}
        }
    }
}
