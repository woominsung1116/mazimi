//! Payment processing (NOT YET IMPLEMENTED)
//! TODO: Implement payment verification when premium features are added.
//! This module is intentionally empty — remove #[allow(dead_code)] when implementing.
// ---------------------------------------------------------------------------
// Payment route skeleton — no live routes yet; suppress dead-code warnings
#![allow(dead_code)]
//
//
// SECURITY: Server-side price validation pattern
//
// NEVER trust a price sent by the client.  Always fetch the canonical price
// from the database and compare it against whatever the client submitted.
// Any mismatch must be rejected — this prevents price-manipulation attacks.
//
// Pattern (to be expanded when payment integration is added):
//
//   // 1. Receive the client's claimed price from the request body
//   let client_price: i64 = input.price;
//
//   // 2. Fetch the authoritative price from the DB — never from the request
//   // SECURITY: Always verify price from DB, never trust client-sent price
//   // let db_price: i64 = sqlx::query_scalar(
//   //     "SELECT price FROM products WHERE id = $1"
//   // )
//   // .bind(input.product_id)
//   // .fetch_one(&pool)
//   // .await?;
//   //
//   // // 3. Reject if they differ
//   // if client_price != db_price {
//   //     return Err((
//   //         StatusCode::BAD_REQUEST,
//   //         Json(json!({ "error": "Price mismatch: payment refused" })),
//   //     ));
//   // }
//   //
//   // // 4. Proceed with payment using db_price, not client_price
//   // process_payment(db_price, ...).await?;
//
// ---------------------------------------------------------------------------

// This module is registered in mod.rs but no routes are wired into the router
// until a real payment provider is integrated.
