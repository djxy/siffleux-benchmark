mod cli;

use std::collections::HashMap;
use std::net::{SocketAddr, ToSocketAddrs, UdpSocket};
use std::thread;
use std::time::{Duration, Instant};

use clap::Parser;
use log::{error, info};

use crate::cli::{Cli, Commands, UdpLatencyArgs};

fn run_server(bind_addr: SocketAddr) {
    let socket = UdpSocket::bind(bind_addr).expect("Failed to bind UDP servers socket.");
    info!("Server listening on {}", bind_addr);
    let mut buf = [0u8; 1024];

    loop {
        if let Ok((len, src)) = socket.recv_from(&mut buf) {
            let _ = socket.send_to(&buf[..len], src);
        }
    }
}

fn run_client(server_addr: SocketAddr, args: UdpLatencyArgs) {
    let total_messages = (args.mps * args.duration) as usize;

    info!("Server:                  {}", server_addr);
    info!("Duration:                {}s", args.duration);
    info!("Messages per second:     {}", args.mps);
    info!("Total messages expected: {}", total_messages);

    let socket = UdpSocket::bind("0.0.0.0:0").expect("Failed to bind UDP client socket.");

    socket
        .connect(server_addr)
        .expect("Failed to connect to target");

    socket
        .set_read_timeout(Some(Duration::from_millis(500)))
        .unwrap();

    let mut payload = [0u8; 4];

    payload.copy_from_slice(&u32::MAX.to_be_bytes());

    let warmup_duration = Duration::from_secs(1);
    let warmup_start = Instant::now();

    info!("Starting warmup");
    let mut t = 0;

    for _ in 0..20 {
        let _ = socket.send(&payload);
        let _ = socket.recv(&mut payload);
        t += 1;
        if warmup_start.elapsed() >= warmup_duration {
            break;
        }
    }

    info!(
        "Warmup duration: {:8.2} µs",
        warmup_start.elapsed().as_nanos() as f64 / 1000.0
    );

    info!("Warmup messages sent: {}", t);

    thread::sleep(Duration::from_millis(100));

    let receiver_socket = socket.try_clone().expect("Failed to clone socket");

    let receiver_handle = thread::spawn(move || {
        let mut ids_received_at: HashMap<usize, Instant> = HashMap::with_capacity(total_messages);
        let mut buf = [0u8; 1024];

        loop {
            match receiver_socket.recv(&mut buf) {
                Ok(_) => {
                    let received_at = Instant::now();
                    let id = u32::from_be_bytes(buf[..4].try_into().unwrap()) as usize;

                    ids_received_at.insert(id, received_at);
                }
                Err(_) => {
                    return ids_received_at;
                }
            }
        }
    });

    let mut ids_sent_at: Vec<Instant> = Vec::with_capacity(total_messages);
    let mut id_counter: u32 = 0;
    let mut payload = [0u8; 4];
    let test_duration = Duration::from_secs(args.duration as u64);
    let sleep_duration = Duration::from_micros((1e6 / args.mps as f64).floor() as u64);
    let start = Instant::now();

    loop {
        let progress = start.elapsed().as_micros() as f64 / test_duration.as_micros() as f64;
        let expected_messages_sent =
            total_messages.min((total_messages as f64 * progress) as usize);
        let messages_to_send = expected_messages_sent - ids_sent_at.len();

        for _ in 0..messages_to_send {
            payload.copy_from_slice(&id_counter.to_be_bytes());

            let send_time = Instant::now();
            let _ = socket.send(&payload);
            ids_sent_at.push(send_time);
            id_counter += 1;
        }

        thread::sleep(sleep_duration);

        if start.elapsed() > test_duration {
            break;
        }
    }

    thread::sleep(Duration::from_secs(1));

    drop(socket);

    let ids_received_at = receiver_handle.join().expect("Receiver thread panicked");
    let mut messages_loss = 0;
    let mut rtt: Vec<f64> = Vec::new();

    for id in 0..ids_sent_at.len() {
        let sent_at = ids_sent_at.get(id).unwrap();

        if let Some(received_at) = ids_received_at.get(&id) {
            rtt.push(received_at.duration_since(*sent_at).as_nanos() as f64 / 1000.0);
        } else {
            messages_loss += 1;
        }
    }
    info!("Messages sent:     {}", ids_sent_at.len());
    info!("Messages received: {}", rtt.len());
    info!("Messages loss:     {}", messages_loss);

    if rtt.is_empty() {
        error!("No responses received. Target may be unreachable or dropping all packets.");
        return;
    }

    rtt.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let calc_percentile = |p: f64| -> f64 {
        let idx = ((rtt.len() as f64 * p).floor() as usize).min(rtt.len() - 1);
        rtt[idx]
    };

    info!("--- Latency Results (Microseconds µs) ---");
    info!("Min:    {:8.2} µs", rtt.first().unwrap());
    info!("p25.00: {:8.2} µs", calc_percentile(0.25));
    info!("p50.00: {:8.2} µs", calc_percentile(0.50));
    info!("p75.00: {:8.2} µs", calc_percentile(0.75));
    info!("p90.00: {:8.2} µs", calc_percentile(0.90));
    info!("p99.00: {:8.2} µs", calc_percentile(0.99));
    info!("p99.90: {:8.2} µs", calc_percentile(0.999));
    info!("p99.99: {:8.2} µs", calc_percentile(0.9999));
    info!("Max:    {:8.2} µs", rtt.last().unwrap());
}

fn main() {
    env_logger::init();
    let cli = Cli::parse();

    match cli.command {
        Commands::Server(args) => {
            run_server(SocketAddr::new(args.ip, args.port));
        }
        Commands::UdpLatency(args) => {
            run_client(
                format!("{}:{}", args.server, args.port)
                    .to_socket_addrs()
                    .unwrap()
                    .next()
                    .unwrap(),
                args,
            );
        }
    }
}
