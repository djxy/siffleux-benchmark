mod cli;

use std::net::{SocketAddr, ToSocketAddrs, UdpSocket};
use std::thread;
use std::time::{Duration, Instant};

use clap::Parser;
use log::info;

use crate::cli::{Cli, Commands, UdpLatencyAgrs};

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

fn run_client(server_addr: SocketAddr, args: UdpLatencyAgrs) {
    info!("Server:              {}", server_addr);
    info!("Duration:            {}s", args.duration);
    info!("Messages per second: {}", args.mps);

    let socket = UdpSocket::bind("0.0.0.0:0").expect("Failed to bind UDP client socket.");

    socket
        .connect(server_addr)
        .expect("Failed to connect to target");

    socket
        .set_read_timeout(Some(Duration::from_secs(1)))
        .unwrap();

    let mut payload = [0u8; 4];

    for _ in 0..1000 {
        let _ = socket.send(&payload);
        let _ = socket.recv(&mut payload);
    }

    thread::sleep(Duration::from_secs(1));

    let total_messages = (args.mps * args.duration) as usize;
    let receiver_socket = socket.try_clone().expect("Failed to clone socket");

    let receiver_handle = thread::spawn(move || {
        let mut ids_received_at: Vec<Instant> = Vec::with_capacity(total_messages);
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

    info!("Test duration:  {}", test_duration.as_secs());
    info!("Sleep duration: {}", sleep_duration.as_micros());

    loop {
        payload.copy_from_slice(&id_counter.to_be_bytes());

        let send_time = Instant::now();
        let _ = socket.send(&payload);
        ids_sent_at.push(send_time);
        id_counter += 1;

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

        if let Some(received_at) = ids_received_at.get(id) {
            rtt.push(received_at.duration_since(*sent_at).as_nanos() as f64 / 1000.0);
        } else {
            messages_loss += 1;
        }
    }

    rtt.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let p25 = rtt[(rtt.len() as f64 * 0.25) as usize];
    let p50 = rtt[(rtt.len() as f64 * 0.50) as usize];
    let p75 = rtt[(rtt.len() as f64 * 0.75) as usize];
    let p90 = rtt[(rtt.len() as f64 * 0.90) as usize];
    let p99 = rtt[(rtt.len() as f64 * 0.99) as usize];
    let min = rtt.first().unwrap();
    let max = rtt.last().unwrap();

    info!("Messages sent:     {}", ids_sent_at.len());
    info!("Messages received: {}", ids_received_at.len());
    info!("Messages loss:     {}", messages_loss);

    info!("--- Latency Results (Microseconds µs) ---");
    info!("Min:   {:8.2} µs", min);
    info!("p25:   {:8.2} µs", p25);
    info!("p50:   {:8.2} µs", p50);
    info!("p75:   {:8.2} µs", p75);
    info!("p90:   {:8.2} µs", p90);
    info!("p99:   {:8.2} µs", p99);
    info!("Max:   {:8.2} µs", max);
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
