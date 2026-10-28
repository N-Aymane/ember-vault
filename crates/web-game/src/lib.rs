//! Narrow, allocation-free snapshot ABI for browser presentation.
#![deny(unsafe_op_in_unsafe_fn)]
use rogue_core::{Actor, Save, World};
use std::cell::RefCell;

thread_local! { static GAME: RefCell<World> = RefCell::new(World::new(1, Save::default())); }

#[no_mangle]
pub extern "C" fn reset(seed: u32, best: u32, cleared: u32) {
    GAME.with(|game| *game.borrow_mut() = World::new(seed, Save { best, cleared }));
}
#[no_mangle]
pub extern "C" fn tick(input: u32) {
    GAME.with(|game| game.borrow_mut().step(input));
}

#[no_mangle]
pub extern "C" fn release_input() {
    GAME.with(|game| game.borrow_mut().release_input());
}
#[no_mangle]
pub extern "C" fn stat(field: u32) -> u32 {
    GAME.with(|game| {
        let game = game.borrow();
        match field {
            0 => game.player.hp.max(0) as u32,
            1 => game.score,
            2 => game.room,
            3 => game.enemies.len() as u32,
            4 => game.platforms.len() as u32,
            5 => game.events,
            6 => game.save.best,
            7 => game.save.cleared,
            8 => u32::from(game.cleared()),
            9 => u32::from(game.player.cooldown),
            _ => 0,
        }
    })
}
fn actor_field(actor: &Actor, field: u32) -> f32 {
    match field {
        0 => actor.rect.x,
        1 => actor.rect.y,
        2 => actor.rect.w,
        3 => actor.rect.h,
        4 => actor.facing,
        5 => actor.hp as f32,
        6 => f32::from(actor.attack),
        7 => f32::from(actor.dodge),
        8 => f32::from(actor.invulnerable),
        9 => actor.vx,
        10 => f32::from(actor.combo),
        11 => f32::from(u8::from(actor.grounded)),
        12 => actor.vy,
        _ => 0.0,
    }
}
#[no_mangle]
pub extern "C" fn entity(kind: u32, index: u32, field: u32) -> f32 {
    GAME.with(|game| {
        let game = game.borrow();
        match kind {
            0 => actor_field(&game.player, field),
            1 => game
                .enemies
                .get(index as usize)
                .map_or(0.0, |actor| actor_field(actor, field)),
            2 => game
                .platforms
                .get(index as usize)
                .map_or(0.0, |rect| match field {
                    0 => rect.x,
                    1 => rect.y,
                    2 => rect.w,
                    3 => rect.h,
                    _ => 0.0,
                }),
            _ => 0.0,
        }
    })
}
#[no_mangle]
pub extern "C" fn save_supported(version: u32) -> u32 {
    u32::from(Save::migrate(version, 0, 0).is_some())
}
#[no_mangle]
pub extern "C" fn self_test() -> u32 {
    rogue_core::regression_suite()
}

#[no_mangle]
pub extern "C" fn controls_test() -> u32 {
    rogue_core::controls_suite()
}
