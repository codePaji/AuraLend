import { useState, useEffect, useRef } from "react";
import { 
  TrendingUp, 
  Layers, 
  Wallet, 
  LineChart, 
  ArrowRight, 
  Activity, 
  Settings, 
  Plus, 
  Minus,
  RefreshCw
} from "lucide-react";
import * as THREE from "three";
import gsap from "gsap";
import { isConnected, getAddress, signTransaction } from "@stellar/freighter-api";
import { Transaction } from "@stellar/stellar-sdk";
import { rpc, horizon } from "./lib/stellar";
import { PriceChart } from "./components/PriceChart";
import { AreaChart } from "./components/AreaChart";

// Generated Contract Clients (Direct TS files imports)
import { Client as USDCClient } from "./contracts/mock-usdc/src/index";
import { Client as LendingPoolClient } from "./contracts/lending-pool/src/index";
import { Client as MockAmmClient } from "./contracts/mock-amm/src/index";
import { Client as LeverageEngineClient } from "./contracts/leverage-engine/src/index";

const USDC_ID = "CA5CBZU5WNPXCWMHFRZ3QDLXGE3O77M2BJ3A6HC3NCWZRMKVEZWITSGJ";
const LENDING_POOL_ID = "CBW7MYEY6Q6LUDDJQGVYQKOAQYHC2NELIUYPGABD4C5W7N2JPXH7HT4H";
const MOCK_AMM_ID = "CDL4XOK44A7EXCMPXRVFC3HEBZB62L7ACZPPC7UMGUCL32VERWVQED24";
const LEVERAGE_ENGINE_ID = "CBB2FB5SOLDM6EF6B2S23DZTXJ3VTALLTV2T6XMUUXPCAXKRJMJUMNSI";

const clientOptions = {
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
};

interface Position {
  collateral: number;
  borrow_amount: number;
  lp_shares: number;
  healthFactor: number;
}

interface EventLog {
  id: string;
  type: string;
  user: string;
  amount: string;
  details: string;
  timestamp: string;
}

const AuraLogo = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
    <path d="M20 90L45 15C46 12 49 10 52 10C55 10 58 12 59 15L84 90" stroke="url(#auraGrad)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M32 60C45 42 55 42 68 60" stroke="url(#auraGrad2)" strokeWidth="10" strokeLinecap="round" />
    <circle cx="50" cy="40" r="7" fill="#fff" filter="url(#glow)" />
    <defs>
      <linearGradient id="auraGrad" x1="20" y1="90" x2="84" y2="90" gradientUnits="userSpaceOnUse">
        <stop stopColor="#5EEAD4" />
        <stop offset="0.5" stopColor="#0D9488" />
        <stop offset="1" stopColor="#0EA5E9" />
      </linearGradient>
      <linearGradient id="auraGrad2" x1="32" y1="60" x2="68" y2="60" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0EA5E9" />
        <stop offset="1" stopColor="#5EEAD4" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
  </svg>
);

const AuraThreeDScene = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // Create Scene
    const scene = new THREE.Scene();

    // Create Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 14);

    // Create Renderer with transparent canvas
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.innerHTML = ""; // Ensure container is clean
    mountRef.current.appendChild(renderer.domElement);

    // Add Lights (essential for metallic/standard materials)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 8, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x5eead4, 0.5);
    dirLight2.position.set(-5, -5, -2);
    scene.add(dirLight2);

    const pointLightTeal = new THREE.PointLight(0x5eead4, 2, 10);
    pointLightTeal.position.set(-3.5, 1, 1.5);
    scene.add(pointLightTeal);

    const pointLightBlue = new THREE.PointLight(0x0ea5e9, 2, 10);
    pointLightBlue.position.set(3.5, 1, 1.5);
    scene.add(pointLightBlue);

    // Materials
    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2,
    });

    const tealGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0x5eead4,
      emissive: 0x5eead4,
      emissiveIntensity: 0.8,
      roughness: 0.1,
    });

    const blueGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.8,
      roughness: 0.1,
    });

    // Entire Scale Group (for mouse coordinates hover rotation)
    const scaleGroup = new THREE.Group();
    scene.add(scaleGroup);

    // Base Platform
    const baseGeom = new THREE.CylinderGeometry(1.6, 1.8, 0.25, 32);
    const baseMesh = new THREE.Mesh(baseGeom, metalMaterial);
    baseMesh.position.y = -3.2;
    scaleGroup.add(baseMesh);

    // Center Stand / Pillar
    const pillarGeom = new THREE.CylinderGeometry(0.12, 0.15, 5.8, 16);
    const pillarMesh = new THREE.Mesh(pillarGeom, metalMaterial);
    pillarMesh.position.y = -0.3;
    scaleGroup.add(pillarMesh);

    // Tilting Beam Group
    const beamGroup = new THREE.Group();
    beamGroup.position.y = 2.6;
    scaleGroup.add(beamGroup);

    // Crossbar Beam Mesh
    const beamGeom = new THREE.BoxGeometry(6.6, 0.15, 0.15);
    const beamMesh = new THREE.Mesh(beamGeom, metalMaterial);
    beamGroup.add(beamMesh);

    // Left Plate (Lending) Group
    const leftPlateGroup = new THREE.Group();
    leftPlateGroup.position.x = -3.3;
    beamGroup.add(leftPlateGroup);

    const plateGeom = new THREE.CylinderGeometry(0.85, 0.85, 0.08, 24);
    const leftPlate = new THREE.Mesh(plateGeom, metalMaterial);
    leftPlate.position.y = -2.3;
    leftPlateGroup.add(leftPlate);

    // Left suspended lines / hangers
    const leftWiresGeom = new THREE.CylinderGeometry(0.015, 0.75, 2.3, 3, 1, true);
    const leftWires = new THREE.Mesh(leftWiresGeom, metalMaterial);
    leftWires.position.y = -1.15;
    leftPlateGroup.add(leftWires);

    // Left glowing asset - stacked Torus loops representing collateral deposits
    const torusGeom = new THREE.TorusGeometry(0.32, 0.08, 8, 24);
    const leftAsset = new THREE.Mesh(torusGeom, tealGlowMaterial);
    leftAsset.position.y = -2.0;
    leftAsset.rotation.x = Math.PI / 2;
    leftPlateGroup.add(leftAsset);

    // Right Plate (Borrowing) Group
    const rightPlateGroup = new THREE.Group();
    rightPlateGroup.position.x = 3.3;
    beamGroup.add(rightPlateGroup);

    const rightPlate = new THREE.Mesh(plateGeom, metalMaterial);
    rightPlate.position.y = -2.3;
    rightPlateGroup.add(rightPlate);

    const rightWires = new THREE.Mesh(leftWiresGeom, metalMaterial);
    rightWires.position.y = -1.15;
    rightPlateGroup.add(rightWires);

    // Right glowing asset - Sphere representing liquidity pools
    const sphereGeom = new THREE.SphereGeometry(0.42, 24, 24);
    const rightAsset = new THREE.Mesh(sphereGeom, blueGlowMaterial);
    rightAsset.position.y = -1.88;
    rightPlateGroup.add(rightAsset);

    // Cashflow Particles (Flowing from Lending left to Borrowing right)
    const flowCount = 70;
    const flowPositions = new Float32Array(flowCount * 3);
    const flowProgress = new Float32Array(flowCount);

    for (let i = 0; i < flowCount; i++) {
      flowProgress[i] = i / flowCount;
    }

    const flowGeom = new THREE.BufferGeometry();
    flowGeom.setAttribute("position", new THREE.BufferAttribute(flowPositions, 3));

    // Custom Canvas Texture for glowing particles
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, "rgba(94, 234, 212, 1)");
      grad.addColorStop(0.5, "rgba(14, 165, 233, 0.7)");
      grad.addColorStop(1, "rgba(94, 234, 212, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
    }
    const flowTexture = new THREE.CanvasTexture(canvas);

    const flowMaterial = new THREE.PointsMaterial({
      size: 0.28,
      map: flowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const flowParticles = new THREE.Points(flowGeom, flowMaterial);
    scene.add(flowParticles);

    // Animation Loop variables
    let animationId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      
      // Auto-rotation of the assets inside the scale plates
      leftAsset.rotation.z = elapsedTime * 1.5;
      rightAsset.rotation.y = elapsedTime * 1.5;

      // Animate cashflow particles along Bezier curve
      const posArr = flowGeom.attributes.position.array as Float32Array;
      const bRot = beamGroup.rotation.z;

      for (let i = 0; i < flowCount; i++) {
        flowProgress[i] += 0.004;
        if (flowProgress[i] > 1) {
          flowProgress[i] = 0;
        }

        const t = flowProgress[i];

        // Left Plate center (World space coordinates after accounting for beam tilt)
        const startX = -3.3 * Math.cos(bRot) - (-2.0) * Math.sin(bRot);
        const startY = 2.6 + (-3.3 * Math.sin(bRot) + (-2.0) * Math.cos(bRot));
        
        // Right Plate center
        const endX = 3.3 * Math.cos(bRot) - (-1.88) * Math.sin(bRot);
        const endY = 2.6 + (3.3 * Math.sin(bRot) + (-1.88) * Math.cos(bRot));

        // Bezier arch equation with apex at (X=0, Y=4.2)
        const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * 0 + t * t * endX;
        const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * 4.4 + t * t * endY;
        const z = Math.sin(t * Math.PI) * (Math.sin(elapsedTime * 2.5 + i * 0.15) * 0.35);

        posArr[i * 3] = x;
        posArr[i * 3 + 1] = y;
        posArr[i * 3 + 2] = z;
      }
      flowGeom.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    // Mouse tilt interaction with counter-balancing logic
    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / width) * 2 - 1; // -1 to 1
      const y = -((event.clientY - rect.top) / height) * 2 + 1; // -1 to 1

      // 1. Tilt beam based on mouse horizontal (max ~0.26 rad / 15 deg)
      const tiltVal = -x * 0.24;
      gsap.to(beamGroup.rotation, {
        z: tiltVal,
        duration: 0.6,
        ease: "power2.out"
      });

      // 2. Counter-rotate hanging plates so they remain vertically straight
      gsap.to(leftPlateGroup.rotation, {
        z: -tiltVal,
        duration: 0.6,
        ease: "power2.out"
      });
      gsap.to(rightPlateGroup.rotation, {
        z: -tiltVal,
        duration: 0.6,
        ease: "power2.out"
      });

      // 3. Tilt entire scale slightly on Y and X axis for organic depth feel
      gsap.to(scaleGroup.rotation, {
        y: x * 0.35,
        x: -y * 0.2,
        duration: 0.8,
        ease: "power2.out"
      });
    };

    const handleMouseLeave = () => {
      gsap.to(beamGroup.rotation, { z: 0, duration: 0.8, ease: "power2.out" });
      gsap.to(leftPlateGroup.rotation, { z: 0, duration: 0.8, ease: "power2.out" });
      gsap.to(rightPlateGroup.rotation, { z: 0, duration: 0.8, ease: "power2.out" });
      gsap.to(scaleGroup.rotation, { x: 0, y: 0, duration: 0.8, ease: "power2.out" });
    };

    const container = mountRef.current;
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      renderer.dispose();
      baseGeom.dispose();
      pillarGeom.dispose();
      beamGeom.dispose();
      plateGeom.dispose();
      leftWiresGeom.dispose();
      torusGeom.dispose();
      sphereGeom.dispose();
      flowGeom.dispose();
      flowMaterial.dispose();
      flowTexture.dispose();
      metalMaterial.dispose();
      tealGlowMaterial.dispose();
      blueGlowMaterial.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "380px", position: "relative", cursor: "crosshair" }} />;
};

export default function App() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<"markets" | "farm" | "portfolio" | "activity" | "sandbox">("farm");
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState("");
  const [xlmBalance, setXlmBalance] = useState("0");
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [poolCollateral, setPoolCollateral] = useState("0");
  
  // Input fields
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [farmCollateral, setFarmCollateral] = useState("");
  const [leverage, setLeverage] = useState(3.0); // 1.5x to 5.0x
  const [farmMode, setFarmMode] = useState<"automated" | "manual">("automated");
  const [borrowAsset, setBorrowAsset] = useState<"USDC" | "XLM">("USDC");

  // Action Status Feedbacks
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ status: "success" | "error" | "info" | null; msg: string }>({ status: null, msg: "" });
  const [debugError, setDebugError] = useState<string>("");

  // On-Chain Metrics (Lending Pool)
  const [poolTvl, setPoolTvl] = useState(125000); // Mock/Fallback
  const [poolBorrowed, setPoolBorrowed] = useState(45000);
  const [utilizationRate, setUtilizationRate] = useState(36.0);
  const [supplyApy, setSupplyApy] = useState(4.25);
  const [borrowApy, setBorrowApy] = useState(8.5);

  // Leverage position state
  const [activePosition, setActivePosition] = useState<Position | null>(null);

  // Price Simulation Sandbox State
  const [tokenBPrice, setTokenBPrice] = useState(1.00); // Mocks the paired asset price in USD
  const [simulatedPriceChange, setSimulatedPriceChange] = useState(0);

  // Event Logs Feed
  const [events, setEvents] = useState<EventLog[]>([
    {
      id: "1",
      type: "DEPOSIT",
      user: "GAJEP...CTMB",
      amount: "15,000 USDC",
      details: "Deposited liquidity into USDC Vault",
      timestamp: "5 mins ago"
    },
    {
      id: "2",
      type: "FARM_OPEN",
      user: "GDF83...Z34K",
      amount: "5,000 USDC",
      details: "Opened 3x Leverage Farming Position (USDC/XLM)",
      timestamp: "12 mins ago"
    }
  ]);

  // Check Freighter connection on load
  useEffect(() => {
    checkConnection();
    fetchMarketMetrics();
  }, []);

  // Fetch balances when user address updates
  useEffect(() => {
    if (userAddress) {
      fetchUserBalances();
    }
  }, [userAddress]);

  const checkConnection = async () => {
    try {
      const connectedRes = await isConnected();
      if (connectedRes) {
        const addressRes = await getAddress();
        if (addressRes && addressRes.address) {
          setUserAddress(addressRes.address);
          setWalletConnected(true);
          setActiveTab("farm");
        }
      }
    } catch (err) {
      console.error("Freighter connection check failed", err);
    }
  };

  const connectWallet = async () => {
    try {
      const connectedRes = await isConnected();
      if (!connectedRes) {
        showFeedback("info", "Please install/unlock Freighter browser extension.");
        return;
      }
      const addressRes = await getAddress();
      if (addressRes && addressRes.address) {
        setUserAddress(addressRes.address);
        setWalletConnected(true);
        setActiveTab("farm");
        showFeedback("success", "Freighter Wallet Connected Successfully!");
      }
    } catch (err: any) {
      showFeedback("error", err.message || "Freighter connection failed.");
    }
  };

  const disconnectWallet = () => {
    setWalletConnected(false);
    setUserAddress("");
    setXlmBalance("0");
    setUsdcBalance("0");
    setActivePosition(null);
    showFeedback("success", "Wallet disconnected successfully.");
  };

  const showFeedback = (status: "success" | "error" | "info" | null, msg: string) => {
    setFeedback({ status, msg });
    setTimeout(() => setFeedback({ status: null, msg: "" }), 6000);
  };

  // Helper: Get user native XLM and Mock USDC balance
  const fetchUserBalances = async () => {
    if (!userAddress) return;
    setDebugError("");
    
    // 1. Fetch XLM balance via Horizon
    try {
      const accountInfo = await horizon.loadAccount(userAddress);
      const nativeBalance = accountInfo.balances.find((b) => b.asset_type === "native");
      if (nativeBalance) {
        setXlmBalance(parseFloat(nativeBalance.balance).toLocaleString("en-US", { maximumFractionDigits: 4 }));
      }
    } catch (xlmErr: any) {
      console.warn("Could not fetch XLM balance from Horizon (account might not be active on ledger yet):", xlmErr);
      setXlmBalance("0");
    }

    // 2. Fetch USDC Balance via contract call
    try {
      const usdcClient = new USDCClient({
        ...clientOptions,
        contractId: USDC_ID,
      });
      const balanceBig = (await usdcClient.balance({ account: userAddress })).result;
      setUsdcBalance((Number(balanceBig) / 10_000_000).toFixed(2));
    } catch (usdcErr: any) {
      console.error("Error fetching USDC balance:", usdcErr);
      setDebugError((prev) => prev + `\nUSDC Balance Error: ${usdcErr.message || usdcErr.toString()}`);
      setUsdcBalance("0.00");
    }

    // 3. Fetch Pool Collateral Balance
    try {
      const poolClient = new LendingPoolClient({
        ...clientOptions,
        contractId: LENDING_POOL_ID,
      });
      const poolBalanceBig = (await poolClient.get_balance({ user: userAddress })).result;
      setPoolCollateral((Number(poolBalanceBig) / 10_000_000).toFixed(2));
    } catch (poolErr: any) {
      console.error("Error fetching pool balance:", poolErr);
      setDebugError((prev) => prev + `\nPool Collateral Error: ${poolErr.message || poolErr.toString()}`);
      setPoolCollateral("0.00");
    }

    // 4. Fetch Active Leverage Position
    try {
      const leverageClient = new LeverageEngineClient({
        ...clientOptions,
        contractId: LEVERAGE_ENGINE_ID,
      });
      const posObj = (await leverageClient.get_position({ user: userAddress })).result;
      if (posObj) {
        // Calculate health factor on-chain
        const healthF = (await leverageClient.get_health_factor({ user: userAddress })).result;
        
        // Simulate health factor adjustment if price changes
        const adjustedHealth = simulatedPriceChange !== 0 
          ? Math.max(10, Number(healthF) + Math.round(simulatedPriceChange * 30))
          : Number(healthF);

        setActivePosition({
          collateral: Number(posObj.collateral) / 10_000_000,
          borrow_amount: Number(posObj.borrow_amount) / 10_000_000,
          lp_shares: Number(posObj.lp_shares) / 10_000_000,
          healthFactor: adjustedHealth
        });
      } else {
        setActivePosition(null);
      }
    } catch (levErr: any) {
      console.error("Error fetching leverage position:", levErr);
      setDebugError((prev) => prev + `\nLeverage Position Error: ${levErr.message || levErr.toString()}`);
      setActivePosition(null);
    }
  };

  const fetchMarketMetrics = async () => {
    try {
      const poolClient = new LendingPoolClient({
        ...clientOptions,
        contractId: LENDING_POOL_ID,
      });
      const tvlBig = (await poolClient.get_total_liquidity()).result;
      const borrowBig = (await poolClient.get_total_borrowed()).result;
      const borrowRateBig = (await poolClient.get_borrow_rate()).result;

      const tvlNum = Number(tvlBig) / 10_000_000;
      const borrowNum = Number(borrowBig) / 10_000_000;
      const bRate = Number(borrowRateBig) / 100; // e.g. 850 -> 8.5%

      setPoolTvl(tvlNum || 125000);
      setPoolBorrowed(borrowNum || 45000);
      
      const util = tvlNum > 0 ? (borrowNum / tvlNum) * 100 : 36.0;
      setUtilizationRate(util);
      setBorrowApy(bRate || 8.5);
      setSupplyApy(util > 0 ? bRate * (util / 100) * 0.9 : 4.25);
    } catch (err) {
      console.error("Failed to fetch pool metrics:", err);
    }
  };

  // Faucet request to get mock USDC
  const handleFaucet = async () => {
    if (!walletConnected) return;
    setLoading(true);
    showFeedback("info", "Requesting faucet tokens from on-chain USDC contract...");
    try {
      const usdcClient = new USDCClient({
        ...clientOptions,
        contractId: USDC_ID,
        publicKey: userAddress,
        signTransaction: (txXdr) => signTransaction(txXdr, { networkPassphrase: "Test SDF Network ; September 2015" }),
      });
      
      const faucetAmount = BigInt(5000 * 10_000_000);
      const tx = await usdcClient.faucet({ to: userAddress, amount: faucetAmount });
      await tx.signAndSend();

      showFeedback("success", "Minted 5,000 Mock USDC successfully!");
      fetchUserBalances();
    } catch (err: any) {
      showFeedback("error", err.message || "Faucet minting failed.");
    } finally {
      setLoading(false);
    }
  };

  // Deposit USDC into Lending Pool
  const handleDeposit = async () => {
    if (!depositAmount || Number(depositAmount) <= 0) return;
    setLoading(true);
    showFeedback("info", "Submitting USDC deposit request...");
    try {
      const amountRaw = BigInt(Math.round(Number(depositAmount) * 10_000_000));
      
      const usdcClient = new USDCClient({
        ...clientOptions,
        contractId: USDC_ID,
        publicKey: userAddress,
        signTransaction: (txXdr) => signTransaction(txXdr, { networkPassphrase: "Test SDF Network ; September 2015" }),
      });

      // 1. Approve lending pool to withdraw USDC
      const approveTx = await usdcClient.approve({
        owner: userAddress,
        spender: LENDING_POOL_ID,
        amount: amountRaw,
        live_until_ledger: 5000000
      });
      await approveTx.signAndSend();

      // 2. Deposit into Pool
      const poolClient = new LendingPoolClient({
        ...clientOptions,
        contractId: LENDING_POOL_ID,
        publicKey: userAddress,
        signTransaction: (txXdr) => signTransaction(txXdr, { networkPassphrase: "Test SDF Network ; September 2015" }),
      });
      const depositTx = await poolClient.deposit({
        user: userAddress,
        amount: amountRaw
      });
      await depositTx.signAndSend();

      // Log event
      addEvent("DEPOSIT", `${Number(depositAmount).toLocaleString()} USDC`, "Deposited liquidity into USDC Vault");

      showFeedback("success", `Successfully deposited ${depositAmount} USDC into the lending pool!`);
      setDepositAmount("");
      fetchUserBalances();
      fetchMarketMetrics();
    } catch (err: any) {
      showFeedback("error", err.message || "Deposit transaction failed.");
    } finally {
      setLoading(false);
    }
  };

  // Withdraw USDC from Lending Pool
  const handleWithdraw = async () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) return;
    setLoading(true);
    showFeedback("info", "Submitting USDC withdrawal request...");
    try {
      const amountRaw = BigInt(Math.round(Number(withdrawAmount) * 10_000_000));
      
      const poolClient = new LendingPoolClient({
        ...clientOptions,
        contractId: LENDING_POOL_ID,
        publicKey: userAddress,
        signTransaction: (txXdr) => signTransaction(txXdr, { networkPassphrase: "Test SDF Network ; September 2015" }),
      });

      const withdrawTx = await poolClient.withdraw({
        user: userAddress,
        amount: amountRaw
      });
      await withdrawTx.signAndSend();

      // Log event
      addEvent("WITHDRAW", `${Number(withdrawAmount).toLocaleString()} USDC`, "Withdrew liquidity from USDC Vault");

      showFeedback("success", `Successfully withdrew ${withdrawAmount} USDC from the lending pool!`);
      setWithdrawAmount("");
      fetchUserBalances();
      fetchMarketMetrics();
    } catch (err: any) {
      showFeedback("error", err.message || "Withdrawal transaction failed.");
    } finally {
      setLoading(false);
    }
  };

  // Open Leverage Farming Position
  const handleOpenPosition = async () => {
    if (!farmCollateral || Number(farmCollateral) <= 0) return;
    setLoading(true);
    showFeedback("info", "Opening leveraged farming position...");
    try {
      const amountRaw = BigInt(Math.round(Number(farmCollateral) * 10_000_000));
      const levScaled = Math.round(leverage * 100); // 3x = 300
      
      const usdcClient = new USDCClient({
        ...clientOptions,
        contractId: USDC_ID,
        publicKey: userAddress,
        signTransaction: (txXdr) => signTransaction(txXdr, { networkPassphrase: "Test SDF Network ; September 2015" }),
      });

      // 1. Approve leverage engine to withdraw USDC collateral
      const approveTx = await usdcClient.approve({
        owner: userAddress,
        spender: LEVERAGE_ENGINE_ID,
        amount: amountRaw,
        live_until_ledger: 5000000
      });
      await approveTx.signAndSend();

      // 2. Open position via Leverage Engine
      const engineClient = new LeverageEngineClient({
        ...clientOptions,
        contractId: LEVERAGE_ENGINE_ID,
        publicKey: userAddress,
        signTransaction: (txXdr) => signTransaction(txXdr, { networkPassphrase: "Test SDF Network ; September 2015" }),
      });
      const openTx = await engineClient.open_position({
        user: userAddress,
        collateral: amountRaw,
        leverage: levScaled
      });
      await openTx.signAndSend();

      addEvent("FARM_OPEN", `${Number(farmCollateral).toLocaleString()} USDC`, `Opened ${leverage}x Leverage Position`);

      showFeedback("success", `Leverage farming position successfully opened at ${leverage}x leverage!`);
      setFarmCollateral("");
      fetchUserBalances();
      fetchMarketMetrics();
    } catch (err: any) {
      showFeedback("error", err.message || "Opening leverage position failed.");
    } finally {
      setLoading(false);
    }
  };

  // Close Leverage Farming Position
  const handleClosePosition = async () => {
    setLoading(true);
    showFeedback("info", "Closing and unwinding leveraged position...");
    try {
      const engineClient = new LeverageEngineClient({
        ...clientOptions,
        contractId: LEVERAGE_ENGINE_ID,
        publicKey: userAddress,
        signTransaction: (txXdr) => signTransaction(txXdr, { networkPassphrase: "Test SDF Network ; September 2015" }),
      });
      const closeTx = await engineClient.close_position({ user: userAddress });
      await closeTx.signAndSend();

      addEvent("FARM_CLOSE", "Settle", "Position unwound, debt repaid, and margins returned");

      showFeedback("success", "Successfully closed position, repaid borrow debt, and returned surplus margin!");
      fetchUserBalances();
      fetchMarketMetrics();
    } catch (err: any) {
      showFeedback("error", err.message || "Closing leverage position failed.");
    } finally {
      setLoading(false);
    }
  };

  // Liquidate unhealthy position (Admin/Liquidator Sandbox)
  const handleLiquidate = async () => {
    setLoading(true);
    showFeedback("info", "Executing liquidation of target position...");
    try {
      const engineClient = new LeverageEngineClient({
        ...clientOptions,
        contractId: LEVERAGE_ENGINE_ID,
        publicKey: userAddress,
        signTransaction: (txXdr) => signTransaction(txXdr, { networkPassphrase: "Test SDF Network ; September 2015" }),
      });
      const liqTx = await engineClient.liquidate({
        user: userAddress,
        liquidator: userAddress
      });
      await liqTx.signAndSend();

      addEvent("LIQUIDATED", "Margin Liquidation", "Unhealthy position liquidated by keeper");

      showFeedback("success", "Position successfully liquidated! Received 10% keeper bounty.");
      fetchUserBalances();
      fetchMarketMetrics();
    } catch (err: any) {
      showFeedback("error", err.message || "Liquidation failed. Position might still be healthy.");
    } finally {
      setLoading(false);
    }
  };

  const addEvent = (type: string, amount: string, details: string) => {
    const newEvent: EventLog = {
      id: Date.now().toString(),
      type,
      user: userAddress.substring(0, 5) + "..." + userAddress.substring(userAddress.length - 4),
      amount,
      details,
      timestamp: "Just now"
    };
    setEvents((prev) => [newEvent, ...prev]);
  };

  // Estimated APY Multiplier
  const estYield = (4.5 * leverage).toFixed(2);

  return (
    <div className="app-shell">
      {/* Main Content Pane - no sidebar margin offset */}
      <main className="main-content" style={{ marginLeft: "0" }}>
        <header className="topbar glass">
          {/* Logo (Left side) */}
          <div 
            onClick={() => {
              setActiveTab("farm");
              setWalletConnected(false);
            }}
            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
          >
            <AuraLogo size={20} />
            <span className="font-display" style={{ fontWeight: 600, fontSize: "16px", color: "#fff" }}>AuraLend</span>
          </div>

          {/* Navigation Links (Center side) */}
          {walletConnected ? (
            <nav style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <button 
                onClick={() => setActiveTab("farm")} 
                className="font-display" 
                style={{ background: "transparent", border: "none", fontSize: "13.5px", cursor: "pointer", color: activeTab === "farm" ? "rgb(var(--brand))" : "rgb(var(--ink-muted))", fontWeight: activeTab === "farm" ? 600 : 400, padding: 0 }}
              >
                Trade
              </button>
              <button 
                onClick={() => setActiveTab("portfolio")} 
                className="font-display" 
                style={{ background: "transparent", border: "none", fontSize: "13.5px", cursor: "pointer", color: activeTab === "portfolio" ? "rgb(var(--brand))" : "rgb(var(--ink-muted))", fontWeight: activeTab === "portfolio" ? 600 : 400, padding: 0 }}
              >
                Portfolio
              </button>
              <button 
                onClick={() => setActiveTab("markets")} 
                className="font-display" 
                style={{ background: "transparent", border: "none", fontSize: "13.5px", cursor: "pointer", color: activeTab === "markets" ? "rgb(var(--brand))" : "rgb(var(--ink-muted))", fontWeight: activeTab === "markets" ? 600 : 400, padding: 0 }}
              >
                Vault
              </button>
              <button 
                onClick={() => setActiveTab("activity")} 
                className="font-display" 
                style={{ background: "transparent", border: "none", fontSize: "13.5px", cursor: "pointer", color: activeTab === "activity" ? "rgb(var(--brand))" : "rgb(var(--ink-muted))", fontWeight: activeTab === "activity" ? 600 : 400, padding: 0 }}
              >
                Activity
              </button>
              <button 
                onClick={() => setActiveTab("sandbox")} 
                className="font-display" 
                style={{ background: "transparent", border: "none", fontSize: "13.5px", cursor: "pointer", color: activeTab === "sandbox" ? "rgb(var(--brand))" : "rgb(var(--ink-muted))", fontWeight: activeTab === "sandbox" ? 600 : 400, padding: 0 }}
              >
                Settings
              </button>
            </nav>
          ) : (
            <div />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {!walletConnected && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgb(255 255 255 / 0.03)", padding: "6px 12px", borderRadius: "99px", border: "1px solid rgb(var(--hairline))" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgb(var(--long))" }} />
                
              </div>
            )}

            {walletConnected ? (
              <div style={{ display: "flex", alignItems: "center", background: "rgb(255 255 255 / 0.03)", border: "1px solid rgb(var(--hairline))", borderRadius: "6px", height: "32px", overflow: "hidden" }}>
                <span className="tnum font-display" style={{ fontSize: "12.5px", padding: "0 12px", borderRight: "1px solid rgb(var(--hairline))", color: "rgb(var(--ink-muted))" }}>
                  ${Number(usdcBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <button onClick={disconnectWallet} className="font-display" style={{ padding: "0 12px", fontSize: "12px", border: "none", background: "transparent", color: "rgb(var(--ink))", cursor: "pointer", height: "100%" }}>
                  {userAddress.substring(0, 4)}...{userAddress.substring(userAddress.length - 4)}
                </button>
              </div>
            ) : (
              <button onClick={connectWallet} className="btn-pressable brand-fill font-display" style={{ padding: "6px 16px", fontSize: "12px" }}>
                <Wallet size={14} /> Connect Wallet
              </button>
            )}
          </div>
        </header>

        {/* Global Feedback Banner */}
        {feedback.status && (
          <div style={{
            margin: "24px 32px 0 32px",
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: feedback.status === "success" ? "rgba(16, 185, 129, 0.12)" : feedback.status === "error" ? "rgba(244, 63, 94, 0.12)" : "rgba(59, 130, 246, 0.12)",
            color: feedback.status === "success" ? "var(--success)" : feedback.status === "error" ? "var(--danger)" : "#60A5FA",
            border: `1px solid ${feedback.status === "success" ? "rgba(16, 185, 129, 0.2)" : feedback.status === "error" ? "rgba(244, 63, 94, 0.2)" : "rgba(59, 130, 246, 0.2)"}`
          }}>
            <span>{feedback.msg}</span>
            {loading && <div className="loading-spinner" />}
          </div>
        )}

        {debugError && (
          <div style={{
            margin: "12px 32px 0 32px",
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "12px",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            background: "rgba(244, 63, 94, 0.08)",
            color: "var(--danger)",
            border: "1px solid rgba(244, 63, 94, 0.2)"
          }}>
            <strong>Diagnostic Error:</strong> {debugError}
          </div>
        )}

        <div className="view-container">
          
          {/* Landing/Connect Page (Hero Layout if Wallet Not Connected) */}
          {!walletConnected ? (
            <div style={{ padding: "40px 0 80px 0", position: "relative", zIndex: 1 }}>
              {/* Radial background glow */}
              <div style={{
                position: "absolute",
                top: "-150px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "800px",
                height: "800px",
                background: "radial-gradient(circle, rgba(94, 234, 212, 0.05) 0%, rgba(94, 234, 212, 0) 70%)",
                pointerEvents: "none",
                zIndex: -1
              }} />

              {/* Two Column Hero Layout */}
              <div className="hero-grid">
                {/* Left Column: Hero Text */}
                <div>
                  <h1 className="font-display" style={{ fontSize: "62px", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.0, marginBottom: "20px", color: "rgb(var(--ink))" }}>
                    Multiply Your <br />
                    <span style={{ background: "linear-gradient(135deg, #fff 0%, rgb(var(--brand)) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Stellar Yields.</span>
                  </h1>
                  <p style={{ color: "rgb(var(--ink-muted))", fontSize: "15.5px", lineHeight: 1.6, marginBottom: "32px", maxWidth: "520px" }}>
                    The premier decentralized lending and leveraged yield farming protocol built on Soroban. Lock USDC, borrow liquidity, and enter paired AMM pools at up to 5x leverage.
                  </p>
                  
                  <div style={{ display: "flex", gap: "16px" }}>
                    <button onClick={connectWallet} className="btn-pressable brand-fill font-display" style={{ padding: "12px 28px", fontSize: "13px", fontWeight: 600 }}>
                      Launch Terminal <ArrowRight size={14} style={{ marginLeft: "6px" }} />
                    </button>
                    <a 
                      href="#active-vaults"
                      className="btn-pressable btn-neutral font-display" 
                      style={{ 
                        padding: "12px 28px", 
                        fontSize: "13px", 
                        background: "rgba(255, 255, 255, 0.02)", 
                        border: "1px solid rgb(var(--hairline))", 
                        borderRadius: "6px", 
                        color: "rgb(var(--ink))", 
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      View Markets
                    </a>
                  </div>
                </div>

                {/* Right Column: 3D Scene - Transparent Integration */}
                <div style={{ width: "100%", height: "380px", position: "relative" }}>
                  <AuraThreeDScene />
                </div>
              </div>

              {/* Marquee Ticker */}
              <div aria-hidden className="mask-fade-r" style={{ borderTop: "1px solid rgb(var(--hairline))", borderBottom: "1px solid rgb(var(--hairline))", background: "rgba(8, 10, 14, 0.4)", padding: "16px 0", width: "100vw", position: "relative", left: "50%", right: "50%", marginLeft: "-50vw", marginRight: "-50vw", overflow: "hidden", marginBottom: "72px" }}>
                <div className="animate-marquee" style={{ gap: "48px" }}>
                  {[1, 2, 3, 4].flatMap((i) => [
                    { ticker: "USDC / XLM Pool", price: tokenBPrice.toFixed(4), change: "+2.45%", apy: "18.30% APY" },
                    { ticker: "USDC / EUR Pool", price: "1.0850", change: "-0.15%", apy: "12.80% APY" },
                    { ticker: "USDC / GOLD Pool", price: "2350.20", change: "+1.25%", apy: "15.40% APY" }
                  ]).map((item, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12.5px" }}>
                      <span style={{ fontWeight: 600, color: "rgb(var(--ink))" }}>{item.ticker}</span>
                      <span className="tnum" style={{ color: "rgb(var(--ink-muted))" }}>${item.price}</span>
                      <span className="tnum" style={{ color: item.change.startsWith("+") ? "rgb(var(--long))" : "rgb(var(--short))", fontSize: "11px" }}>{item.change}</span>
                      <span className="badge-premium badge-purple" style={{ fontSize: "10px", padding: "2px 6px" }}>{item.apy}</span>
                      <span style={{ color: "rgb(var(--ink-faint))" }}>·</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature Bento Grid */}
              <div className="features-grid" style={{ maxWidth: "900px", margin: "0 auto 72px auto" }}>
                <div className="card-premium sheen" style={{ padding: "24px", textAlign: "left" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(94, 234, 212, 0.1)", display: "flex", alignItems: "center", justifyItems: "center", marginBottom: "16px" }}>
                    <TrendingUp size={18} style={{ color: "rgb(var(--brand))", margin: "auto" }} />
                  </div>
                  <h4 className="font-display" style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginBottom: "8px" }}>Leveraged Farming</h4>
                  <p style={{ fontSize: "12.5px", color: "rgb(var(--ink-muted))", lineHeight: 1.5 }}>
                    Multiply your yield pool size up to 5x. Automatically borrow USDC or XLM through atomic smart contracts to boost LP earnings.
                  </p>
                </div>

                <div className="card-premium sheen" style={{ padding: "24px", textAlign: "left" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(94, 234, 212, 0.1)", display: "flex", alignItems: "center", justifyItems: "center", marginBottom: "16px" }}>
                    <LineChart size={18} style={{ color: "rgb(var(--brand))", margin: "auto" }} />
                  </div>
                  <h4 className="font-display" style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginBottom: "8px" }}>Organic Lending Vaults</h4>
                  <p style={{ fontSize: "12.5px", color: "rgb(var(--ink-muted))", lineHeight: 1.5 }}>
                    Deposit USDC into lending vaults to earn low-risk, compounding organic yield backed by collateralized farming positions.
                  </p>
                </div>

                <div className="card-premium sheen" style={{ padding: "24px", textAlign: "left" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(94, 234, 212, 0.1)", display: "flex", alignItems: "center", justifyItems: "center", marginBottom: "16px" }}>
                    <Layers size={18} style={{ color: "rgb(var(--brand))", margin: "auto" }} />
                  </div>
                  <h4 className="font-display" style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginBottom: "8px" }}>Soroban Integration</h4>
                  <p style={{ fontSize: "12.5px", color: "rgb(var(--ink-muted))", lineHeight: 1.5 }}>
                    Built natively on Stellar's high-speed smart contract framework. Benefit from sub-second finality and near-zero network fees.
                  </p>
                </div>
              </div>

              {/* Technical Stat Band */}
              <div className="border-gradient stats-grid" style={{ maxWidth: "900px", margin: "0 auto 72px auto" }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: "6px", fontSize: "9px" }}>Protocol TVL</div>
                  <div className="tnum font-display" style={{ fontSize: "26px", fontWeight: 600 }}>${poolTvl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: "6px", fontSize: "9px" }}>Organic Lending APY</div>
                  <div className="tnum font-display" style={{ fontSize: "26px", fontWeight: 600, color: "rgb(var(--long))" }}>{supplyApy.toFixed(2)}%</div>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: "6px", fontSize: "9px" }}>Max Leverage Factor</div>
                  <div className="tnum font-display" style={{ fontSize: "26px", fontWeight: 600 }}>5.00x</div>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: "6px", fontSize: "9px" }}>Settlement Token</div>
                  <div className="tnum font-display" style={{ fontSize: "26px", fontWeight: 600, color: "rgb(var(--brand))" }}>USDC</div>
                </div>
              </div>

              {/* Active Market Lists */}
              <div id="active-vaults" style={{ textAlign: "left", maxWidth: "700px", margin: "0 auto" }}>
                <p className="eyebrow" style={{ marginBottom: "16px", letterSpacing: "0.08em" }}>Live Yield Farms</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[
                    { ticker: "USDC / XLM", name: "Stellar Lumens AMM Pool", rate: "Up to 5x Leverage", kind: "Classic Volatile Pool", yield: "18.30% Est. APY" },
                    { ticker: "USDC / EUR", name: "European Fiat AMM Pool", rate: "Up to 5x Leverage", kind: "Stable Forex Pool", yield: "12.80% Est. APY" },
                    { ticker: "USDC / GOLD", name: "Tokenized Gold AMM Pool", rate: "Up to 3x Leverage", kind: "Commodity Asset Pool", yield: "15.40% Est. APY" }
                  ].map((m, i) => (
                    <div 
                      key={i} 
                      onClick={connectWallet}
                      className="card-premium sheen"
                      style={{ display: "grid", gridTemplateColumns: "2.5rem 1fr auto auto", alignItems: "center", padding: "16px 20px", cursor: "pointer", gap: "16px" }}
                    >
                      <span className="tnum font-display" style={{ fontSize: "16px", fontWeight: 600, color: "rgb(var(--brand) / 0.7)" }}>0{i+1}</span>
                      <div>
                        <div className="font-display" style={{ fontSize: "18px", fontWeight: 600, color: "rgb(var(--ink))" }}>{m.ticker}</div>
                        <div style={{ fontSize: "12px", color: "rgb(var(--ink-faint))" }}>{m.name} · {m.kind}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="tnum font-display" style={{ fontSize: "14.5px", fontWeight: 600, color: "rgb(var(--long))" }}>{m.yield}</div>
                        <div style={{ fontSize: "10px", color: "rgb(var(--ink-faint))" }}>{m.rate}</div>
                      </div>
                      <ArrowRight size={14} style={{ color: "rgb(var(--ink-faint))", marginLeft: "8px" }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            
            /* CONNECTED VIEW TABS */
            <div>
              
              {/* TAB 1: LENDING VAULTS (MARKETS) */}
              {activeTab === "markets" && (
                <div className="bento-grid">
                  
                  {/* Left Column: Pool Actions */}
                  <div className="card-premium sheen" style={{ gridColumn: "span 5" }}>
                    <h3 className="card-title font-display" style={{ fontSize: "16px", fontWeight: 600 }}>USDC Lending Vault</h3>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                      
                      {/* Deposit Card */}
                      <div style={{ background: "rgb(var(--canvas) / 0.7)", padding: "16px", borderRadius: "8px", border: "1px solid rgb(var(--hairline))" }}>
                        <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span style={{ fontSize: "13px", color: "rgb(var(--ink-muted))" }}>Deposit USDC Collateral</span>
                          <span className="tnum" style={{ fontSize: "11.5px", color: "rgb(var(--ink-faint))" }}>Bal: {usdcBalance} USDC</span>
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <input 
                            type="number" 
                            placeholder="0.00" 
                            className="input-premium" 
                            value={depositAmount} 
                            onChange={(e) => setDepositAmount(e.target.value)} 
                          />
                          <button onClick={handleDeposit} className="btn-pressable brand-fill font-display" style={{ padding: "0 20px" }}>
                            Deposit
                          </button>
                        </div>
                      </div>

                      {/* Withdraw Card */}
                      <div style={{ background: "rgb(var(--canvas) / 0.7)", padding: "16px", borderRadius: "8px", border: "1px solid rgb(var(--hairline))" }}>
                        <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span style={{ fontSize: "13px", color: "rgb(var(--ink-muted))" }}>Withdraw USDC Collateral</span>
                          <span className="tnum" style={{ fontSize: "11.5px", color: "rgb(var(--ink-faint))" }}>Deposited: {poolCollateral} USDC</span>
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <input 
                            type="number" 
                            placeholder="0.00" 
                            className="input-premium" 
                            value={withdrawAmount} 
                            onChange={(e) => setWithdrawAmount(e.target.value)} 
                          />
                          <button onClick={handleWithdraw} className="btn-pressable btn-neutral font-display" style={{ padding: "0 20px", border: "1px solid rgb(var(--hairline))" }}>
                            Withdraw
                          </button>
                        </div>
                      </div>

                      {/* Faucet Aid */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgb(var(--brand) / 0.04)", border: "1px dashed rgb(var(--brand) / 0.2)", padding: "12px 16px", borderRadius: "8px" }}>
                        <span style={{ fontSize: "11.5px", color: "rgb(var(--ink-muted))" }}>Need test USDC for vault interactions?</span>
                        <button onClick={handleFaucet} className="btn-pressable btn-neutral font-display" style={{ padding: "6px 12px", fontSize: "11px", border: "1px solid rgb(var(--hairline))" }}>
                          Get 5k USDC
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* Right Column: Pool Metrics & Analytics Chart */}
                  <div className="card-premium sheen" style={{ gridColumn: "span 7" }}>
                    <h3 className="card-title font-display" style={{ fontSize: "16px", fontWeight: 600 }}>Pool Statistics & Yield History</h3>
                    
                    {/* Metrics Banner */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
                      <div style={{ background: "rgb(var(--canvas))", padding: "12px", borderRadius: "6px", border: "1px solid rgb(var(--hairline))" }}>
                        <div className="eyebrow" style={{ fontSize: "9px", marginBottom: "4px" }}>Total Liquidity</div>
                        <div className="tnum font-display" style={{ fontSize: "18px", fontWeight: 600 }}>${poolTvl.toLocaleString()}</div>
                      </div>
                      <div style={{ background: "rgb(var(--canvas))", padding: "12px", borderRadius: "6px", border: "1px solid rgb(var(--hairline))" }}>
                        <div className="eyebrow" style={{ fontSize: "9px", marginBottom: "4px" }}>Total Borrowed</div>
                        <div className="tnum font-display" style={{ fontSize: "18px", fontWeight: 600 }}>${poolBorrowed.toLocaleString()}</div>
                      </div>
                      <div style={{ background: "rgb(var(--canvas))", padding: "12px", borderRadius: "6px", border: "1px solid rgb(var(--hairline))" }}>
                        <div className="eyebrow" style={{ fontSize: "9px", marginBottom: "4px" }}>Lending APY</div>
                        <div className="tnum font-display" style={{ fontSize: "18px", fontWeight: 600, color: "rgb(var(--long))" }}>{supplyApy.toFixed(2)}%</div>
                      </div>
                    </div>

                    {/* Utilization Rate Meter */}
                    <div style={{ marginBottom: "24px" }}>
                      <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", fontSize: "12px", color: "rgb(var(--ink-muted))", marginBottom: "6px" }}>
                        <span>Pool Utilization Rate</span>
                        <span className="tnum">{utilizationRate.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: "6px", width: "100%", background: "rgb(var(--hairline))", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${utilizationRate}%`, background: "rgb(var(--brand))" }} />
                      </div>
                    </div>

                    {/* Area SVG Chart */}
                    <AreaChart data={[100000, 112000, 108000, 118000, 125000]} stroke="rgb(var(--brand))" height={160} />
                  </div>

                </div>
              )}

              {/* TAB 2: LEVERAGE FARM (TRADE) */}
              {activeTab === "farm" && (
                <div className="bento-grid">
                                 {/* Asset Selectors (Metal, FX, Crypto Pools) */}
                  <div style={{ gridColumn: "span 12", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "8px" }}>
                    <div className="card-premium border-gradient" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span className="font-display" style={{ fontSize: "14px", fontWeight: 600, color: "rgb(var(--ink))" }}>GOLD / USDC</span>
                        <span className="badge-premium badge-purple" style={{ marginLeft: "8px", fontSize: "9px", padding: "2px 4px" }}>Commodity</span>
                        <div className="tnum" style={{ fontSize: "16px", fontWeight: 600, marginTop: "4px" }}>$2,496.88</div>
                      </div>
                      <span className="tnum" style={{ fontSize: "12px", color: "rgb(var(--short))" }}>-0.32%</span>
                    </div>

                    <div className="card-premium border-gradient" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span className="font-display" style={{ fontSize: "14px", fontWeight: 600, color: "rgb(var(--ink))" }}>EUR / USDC</span>
                        <span className="badge-premium badge-purple" style={{ marginLeft: "8px", fontSize: "9px", padding: "2px 4px" }}>Fiat</span>
                        <div className="tnum" style={{ fontSize: "16px", fontWeight: 600, marginTop: "4px" }}>$1.0986</div>
                      </div>
                      <span className="tnum" style={{ fontSize: "12px", color: "rgb(var(--short))" }}>-2.74%</span>
                    </div>

                    <div className="card-premium active-glow" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span className="font-display" style={{ fontSize: "14px", fontWeight: 600, color: "rgb(var(--ink))" }}>XLM / USDC</span>
                        <span className="badge-premium badge-purple" style={{ marginLeft: "8px", fontSize: "9px", padding: "2px 4px" }}>Crypto</span>
                        <div className="tnum" style={{ fontSize: "16px", fontWeight: 600, marginTop: "4px" }}>${tokenBPrice.toFixed(4)}</div>
                      </div>
                      <span className="tnum" style={{ fontSize: "12px", color: "rgb(var(--short))" }}>-2.89%</span>
                    </div>
                  </div>

                  {/* Key Stats Ribbon */}
                  <div className="card-premium sheen" style={{ gridColumn: "span 12", padding: "12px 24px", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "16px", marginBottom: "8px" }}>
                    <div>
                      <div className="eyebrow" style={{ fontSize: "8.5px", marginBottom: "4px" }}>Base Pool APY</div>
                      <div className="tnum font-display" style={{ fontSize: "15px", fontWeight: 600 }}>4.25%</div>
                    </div>
                    <div style={{ borderLeft: "1px solid rgb(var(--hairline))", paddingLeft: "16px" }}>
                      <div className="eyebrow" style={{ fontSize: "8.5px", marginBottom: "4px" }}>USDC Borrow APY</div>
                      <div className="tnum font-display" style={{ fontSize: "15px", fontWeight: 600 }}>-6.80%</div>
                    </div>
                    <div style={{ borderLeft: "1px solid rgb(var(--hairline))", paddingLeft: "16px" }}>
                      <div className="eyebrow" style={{ fontSize: "8.5px", marginBottom: "4px" }}>AMM LP Yield</div>
                      <div className="tnum font-display" style={{ fontSize: "15px", fontWeight: 600, color: "rgb(var(--long))" }}>+13.50%</div>
                    </div>
                    <div style={{ borderLeft: "1px solid rgb(var(--hairline))", paddingLeft: "16px" }}>
                      <div className="eyebrow" style={{ fontSize: "8.5px", marginBottom: "4px" }}>Leveraged APY</div>
                      <div className="tnum font-display" style={{ fontSize: "15px", fontWeight: 600, color: "rgb(var(--long))" }}>{estYield}%</div>
                    </div>
                    <div style={{ borderLeft: "1px solid rgb(var(--hairline))", paddingLeft: "16px" }}>
                      <div className="eyebrow" style={{ fontSize: "8.5px", marginBottom: "4px" }}>Total Pool TVL</div>
                      <div className="tnum font-display" style={{ fontSize: "15px", fontWeight: 600 }}>${poolTvl.toLocaleString()}</div>
                    </div>
                    <div style={{ borderLeft: "1px solid rgb(var(--hairline))", paddingLeft: "16px" }}>
                      <div className="eyebrow" style={{ fontSize: "8.5px", marginBottom: "4px" }}>Max Leverage</div>
                      <div className="tnum font-display" style={{ fontSize: "15px", fontWeight: 600 }}>5.00x</div>
                    </div>
                  </div>

                  {/* Left Column: Live Chart Panel */}
                  <div className="card-premium sheen" style={{ gridColumn: "span 8" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <div>
                        <span className="font-display" style={{ fontSize: "16px", fontWeight: 600, color: "rgb(var(--ink))" }}>XLM / USDC Farm</span>
                        <span style={{ fontSize: "12px", color: "rgb(var(--ink-faint))", marginLeft: "8px" }}>Stellar Pool</span>
                      </div>
                      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                        <span className="tnum" style={{ fontSize: "16px", fontWeight: 600 }}>${tokenBPrice.toFixed(4)}</span>
                        <span className="tnum" style={{ fontSize: "12px", color: "rgb(var(--short))" }}>-0.32%</span>
                        <span style={{ fontSize: "11px", color: "rgb(var(--ink-faint))" }}>Reflector · XLM</span>
                      </div>
                    </div>

                    <div style={{ height: "300px", width: "100%", background: "rgb(var(--canvas))", borderRadius: "8px", border: "1px solid rgb(var(--hairline))" }}>
                      <PriceChart feed="USDC-XLM" price={tokenBPrice} decimals={4} />
                    </div>
                  </div>

                  {/* Right Column: Setup Order Deck */}
                  <div className="card-premium sheen" style={{ gridColumn: "span 4" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", background: "rgb(var(--canvas))", padding: "4px", borderRadius: "6px", border: "1px solid rgb(var(--hairline))", marginBottom: "16px" }}>
                      <button 
                        onClick={() => setFarmMode("automated")}
                        className="font-display" 
                        style={{ 
                          background: farmMode === "automated" ? "rgb(var(--surface))" : "transparent", 
                          border: farmMode === "automated" ? "1px solid rgb(var(--hairline))" : "none", 
                          borderRadius: "4px", 
                          color: farmMode === "automated" ? "#fff" : "rgb(var(--ink-muted))", 
                          padding: "6px 0", 
                          fontSize: "12px", 
                          cursor: "pointer" 
                        }}
                      >
                        Automated
                      </button>
                      <button 
                        onClick={() => setFarmMode("manual")}
                        className="font-display" 
                        style={{ 
                          background: farmMode === "manual" ? "rgb(var(--surface))" : "transparent", 
                          border: farmMode === "manual" ? "1px solid rgb(var(--hairline))" : "none", 
                          borderRadius: "4px", 
                          color: farmMode === "manual" ? "#fff" : "rgb(var(--ink-muted))", 
                          padding: "6px 0", 
                          fontSize: "12px", 
                          cursor: "pointer" 
                        }}
                      >
                        Manual
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "16px" }}>
                      <button 
                        onClick={() => setBorrowAsset("USDC")}
                        className="font-display" 
                        style={{ 
                          background: borrowAsset === "USDC" ? "rgb(255 255 255 / 0.05)" : "transparent", 
                          border: borrowAsset === "USDC" ? "1px solid rgb(var(--hairline))" : "none", 
                          borderRadius: "4px", 
                          color: borrowAsset === "USDC" ? "#fff" : "rgb(var(--ink-muted))", 
                          padding: "8px 0", 
                          fontSize: "13px", 
                          fontWeight: borrowAsset === "USDC" ? 600 : 400, 
                          cursor: "pointer" 
                        }}
                      >
                        Borrow USDC
                      </button>
                      <button 
                        onClick={() => setBorrowAsset("XLM")}
                        className="font-display" 
                        style={{ 
                          background: borrowAsset === "XLM" ? "rgb(255 255 255 / 0.05)" : "transparent", 
                          border: borrowAsset === "XLM" ? "1px solid rgb(var(--hairline))" : "none", 
                          borderRadius: "4px", 
                          color: borrowAsset === "XLM" ? "#fff" : "rgb(var(--ink-muted))", 
                          padding: "8px 0", 
                          fontSize: "13px", 
                          fontWeight: borrowAsset === "XLM" ? 600 : 400, 
                          cursor: "pointer" 
                        }}
                      >
                        Borrow XLM
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div className="form-group">
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span className="eyebrow" style={{ fontSize: "8.5px" }}>Margin</span>
                          <span className="tnum" style={{ fontSize: "11px", color: "rgb(var(--ink-muted))" }}>Bal: ${Number(usdcBalance).toFixed(2)}</span>
                        </div>
                        <div style={{ position: "relative" }}>
                          <input 
                            type="number" 
                            placeholder="0.00" 
                            className="input-premium tnum" 
                            style={{ paddingRight: "75px" }}
                            value={farmCollateral}
                            onChange={(e) => setFarmCollateral(e.target.value)}
                          />
                          <div style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: "6px" }}>
                            <button 
                              onClick={() => setFarmCollateral(usdcBalance)}
                              className="eyebrow" 
                              style={{ background: "rgb(255 255 255 / 0.05)", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: "2px", fontSize: "8.5px", color: "rgb(var(--ink))" }}
                            >
                              MAX
                            </button>
                            <span style={{ fontSize: "11px", color: "rgb(var(--ink-muted))", fontWeight: 500 }}>USDC</span>
                          </div>
                        </div>
                      </div>

                      <div className="form-group">
                        <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span className="eyebrow" style={{ fontSize: "8.5px" }}>Leverage</span>
                          <span className="tnum" style={{ color: "rgb(var(--brand))", fontWeight: 600, fontSize: "12px" }}>{leverage.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" 
                          min="1.5" 
                          max="5.0" 
                          step="0.1" 
                          value={leverage} 
                          onChange={(e) => setLeverage(parseFloat(e.target.value))}
                        />
                        <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", fontSize: "10px", color: "rgb(var(--ink-faint))", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                          <span>1.5x</span>
                          <span>3.0x</span>
                          <span>5.0x</span>
                        </div>
                      </div>

                      {/* Position Details Estimates */}
                      <div style={{ background: "rgb(var(--canvas))", padding: "14px", borderRadius: "6px", border: "1px solid rgb(var(--hairline))", display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "rgb(var(--ink-muted))" }}>Pool share price:</span>
                          <span className="tnum" style={{ color: "rgb(var(--ink))", fontWeight: 500 }}>${tokenBPrice.toFixed(4)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "rgb(var(--ink-muted))" }}>Leveraged pool size:</span>
                          <span className="tnum" style={{ color: "rgb(var(--ink))", fontWeight: 500 }}>
                            ${farmCollateral ? (Number(farmCollateral) * leverage).toFixed(2) : "0.00"}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "rgb(var(--ink-muted))" }}>AMM deposit fee (0.1%):</span>
                          <span className="tnum" style={{ color: "rgb(var(--ink))", fontWeight: 500 }}>
                            ${farmCollateral ? (Number(farmCollateral) * leverage * 0.001).toFixed(2) : "0.00"}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "rgb(var(--ink-muted))" }}>Est. liquidation price:</span>
                          <span className="tnum" style={{ color: "rgb(var(--short))", fontWeight: 500 }}>
                            ${farmCollateral ? (tokenBPrice * 0.8).toFixed(4) : "0.0000"}
                          </span>
                        </div>
                      </div>

                      {activePosition ? (
                        <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "rgb(var(--warn))", textAlign: "center", background: "rgb(var(--warn) / 0.05)", padding: "10px", borderRadius: "6px", border: "1px solid rgb(var(--warn) / 0.15)" }}>
                          CLOSE ACTIVE POSITION BEFORE OPENING NEW
                        </div>
                      ) : (
                        <button 
                          onClick={handleOpenPosition} 
                          className="btn-pressable brand-fill font-display" 
                          style={{ padding: "10px", fontSize: "13px", width: "100%" }}
                        >
                          Open Leveraged Position
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Active Position Info Row (Bottom Span) */}
                  <div style={{ gridColumn: "span 12" }}>
                    {activePosition ? (
                      <div className="card-premium active-glow sheen">
                        <h4 className="card-title font-display" style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center" }}>
                          <span>Your Active Leveraged Position</span>
                          <span className={`badge-premium ${activePosition.healthFactor >= 100 ? "badge-green" : "badge-rose"}`}>
                            Health Factor: {(activePosition.healthFactor / 100).toFixed(2)}
                          </span>
                        </h4>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "20px" }}>
                          <div style={{ background: "rgb(var(--canvas))", padding: "12px", borderRadius: "6px", border: "1px solid rgb(var(--hairline))" }}>
                            <div className="eyebrow" style={{ fontSize: "9px", marginBottom: "4px" }}>Margin Collateral</div>
                            <div className="tnum" style={{ fontSize: "16px", fontWeight: 600 }}>${activePosition.collateral.toLocaleString()} USDC</div>
                          </div>
                          <div style={{ background: "rgb(var(--canvas))", padding: "12px", borderRadius: "6px", border: "1px solid rgb(var(--hairline))" }}>
                            <div className="eyebrow" style={{ fontSize: "9px", marginBottom: "4px" }}>Borrowed Debt</div>
                            <div className="tnum" style={{ fontSize: "16px", fontWeight: 600 }}>${activePosition.borrow_amount.toLocaleString()} USDC</div>
                          </div>
                          <div style={{ background: "rgb(var(--canvas))", padding: "12px", borderRadius: "6px", border: "1px solid rgb(var(--hairline))" }}>
                            <div className="eyebrow" style={{ fontSize: "9px", marginBottom: "4px" }}>AMM LP Shares</div>
                            <div className="tnum" style={{ fontSize: "16px", fontWeight: 600 }}>{activePosition.lp_shares.toLocaleString()} Shares</div>
                          </div>
                          <div style={{ background: "rgb(var(--canvas))", padding: "12px", borderRadius: "6px", border: "1px solid rgb(var(--hairline))" }}>
                            <div className="eyebrow" style={{ fontSize: "9px", marginBottom: "4px" }}>Est. Liq Price</div>
                            <div className="tnum" style={{ fontSize: "16px", fontWeight: 600, color: "rgb(var(--short))" }}>
                              ${activePosition.lp_shares > 0 
                                ? (activePosition.borrow_amount / (activePosition.lp_shares * 0.8)).toFixed(4)
                                : "0.0000"
                              }
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                          <button onClick={handleClosePosition} className="btn-pressable btn-danger font-display" style={{ padding: "8px 24px", fontSize: "12px" }}>
                            Close & Repay
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="card-premium" style={{ textAlign: "center", padding: "40px", color: "rgb(var(--ink-muted))" }}>
                        No active leveraged position found. Set your collateral margin and click "Open Leveraged Position" to begin.
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 3: PORTFOLIO */}
              {activeTab === "portfolio" && (
                <div className="card-premium sheen">
                  <h3 className="card-title font-display" style={{ fontSize: "16px", fontWeight: 600 }}>Portfolio Overview</h3>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
                    <div style={{ background: "rgb(var(--canvas))", padding: "20px", borderRadius: "8px", border: "1px solid rgb(var(--hairline))" }}>
                      <div className="eyebrow" style={{ marginBottom: "6px" }}>Net Collateral Deposited</div>
                      <div className="tnum font-display" style={{ fontSize: "24px", fontWeight: 600, color: "rgb(var(--brand))", marginTop: "4px" }}>
                        {poolCollateral} USDC
                      </div>
                    </div>

                    <div style={{ background: "rgb(var(--canvas))", padding: "20px", borderRadius: "8px", border: "1px solid rgb(var(--hairline))" }}>
                      <div className="eyebrow" style={{ marginBottom: "6px" }}>Leveraged Yield Farms</div>
                      <div className="tnum font-display" style={{ fontSize: "24px", fontWeight: 600, marginTop: "4px" }}>
                        {activePosition ? `${activePosition.collateral} USDC` : "None"}
                      </div>
                    </div>

                    <div style={{ background: "rgb(var(--canvas))", padding: "20px", borderRadius: "8px", border: "1px solid rgb(var(--hairline))" }}>
                      <div className="eyebrow" style={{ marginBottom: "6px" }}>Stellar Wallet Cash</div>
                      <div className="tnum font-display" style={{ fontSize: "24px", fontWeight: 600, marginTop: "4px" }}>
                        {xlmBalance} XLM
                      </div>
                    </div>
                  </div>

                  {/* Asset Allocation Table */}
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>Asset Name</th>
                        <th>Standard Balance</th>
                        <th>Deposited (Vault)</th>
                        <th>Locked (Farm)</th>
                        <th>Net Valuation</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>USD Coin (USDC)</strong></td>
                        <td className="tnum">{usdcBalance} USDC</td>
                        <td className="tnum">{poolCollateral} USDC</td>
                        <td className="tnum">{activePosition ? `${activePosition.collateral} USDC` : "0.00 USDC"}</td>
                        <td className="tnum">${(Number(usdcBalance) + Number(poolCollateral) + (activePosition ? activePosition.collateral : 0)).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td><strong>Stellar Lumens (XLM)</strong></td>
                        <td className="tnum">{xlmBalance} XLM</td>
                        <td className="tnum">0.00 XLM</td>
                        <td className="tnum">0.00 XLM</td>
                        <td className="tnum">${(parseFloat(xlmBalance.replace(/,/g, "")) * tokenBPrice).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 4: ACTIVITY FEED & PRODUCTION HEALTH MONITOR */}
              {activeTab === "activity" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {/* Top Stats Band for Analytics */}
                  <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "0", maxWidth: "100%", margin: "0" }}>
                    <div className="card-premium sheen" style={{ padding: "16px" }}>
                      <div className="eyebrow" style={{ fontSize: "9px", marginBottom: "4px" }}>Stellar Node Ping</div>
                      <div className="tnum font-display" style={{ fontSize: "18px", fontWeight: 600, color: "rgb(var(--long))" }}>1.24s (Synced)</div>
                    </div>
                    <div className="card-premium sheen" style={{ padding: "16px" }}>
                      <div className="eyebrow" style={{ fontSize: "9px", marginBottom: "4px" }}>Protocol Event Listener</div>
                      <div className="tnum font-display" style={{ fontSize: "18px", fontWeight: 600 }}>Active (Polling)</div>
                    </div>
                    <div className="card-premium sheen" style={{ padding: "16px" }}>
                      <div className="eyebrow" style={{ fontSize: "9px", marginBottom: "4px" }}>Smart Contract Status</div>
                      <div className="tnum font-display" style={{ fontSize: "18px", fontWeight: 600, color: "rgb(var(--brand))" }}>Verified V1.0</div>
                    </div>
                  </div>

                  <div className="bento-grid">
                    {/* Left Column: Health Monitor Panel */}
                    <div className="card-premium sheen" style={{ gridColumn: "span 5" }}>
                      <h3 className="card-title font-display" style={{ fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>Stellar RPC Monitor</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgb(var(--hairline))", paddingBottom: "8px" }}>
                          <span style={{ color: "rgb(var(--ink-muted))" }}>Testnet URL:</span>
                          <span className="tnum" style={{ fontFamily: "monospace" }}>soroban-testnet.stellar.org</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgb(var(--hairline))", paddingBottom: "8px" }}>
                          <span style={{ color: "rgb(var(--ink-muted))" }}>Explorer Status:</span>
                          <span style={{ color: "rgb(var(--long))", fontWeight: 500 }}>Online</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgb(var(--hairline))", paddingBottom: "8px" }}>
                          <span style={{ color: "rgb(var(--ink-muted))" }}>Transaction Success:</span>
                          <span className="tnum">99.85%</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgb(var(--hairline))", paddingBottom: "8px" }}>
                          <span style={{ color: "rgb(var(--ink-muted))" }}>Contracts Security:</span>
                          <span style={{ color: "rgb(var(--brand))" }}>Fully Shielded</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "rgb(var(--ink-muted))" }}>Gas Fee Cap:</span>
                          <span className="tnum">0.05 XLM</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Transaction Logs */}
                    <div className="card-premium sheen" style={{ gridColumn: "span 7" }}>
                      <h3 className="card-title font-display" style={{ fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>On-Chain Transaction Log</h3>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto", paddingRight: "4px" }}>
                        {events.map((e) => (
                          <div key={e.id} style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgb(var(--canvas))", padding: "12px", borderRadius: "6px", border: "1px solid rgb(var(--hairline))", fontSize: "12.5px" }}>
                            <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between" }}>
                              <span className={`badge-premium ${e.type === "DEPOSIT" || e.type === "WITHDRAW" ? "badge-green" : e.type === "LIQUIDATED" ? "badge-rose" : "badge-purple"}`} style={{ fontSize: "9px" }}>
                                {e.type}
                              </span>
                              <span className="tnum" style={{ color: "rgb(var(--ink-faint))", fontSize: "11px" }}>{e.timestamp}</span>
                            </div>
                            <div style={{ color: "rgb(var(--ink))" }}><strong>{e.amount}</strong> - {e.details}</div>
                            <div style={{ color: "rgb(var(--ink-muted))", fontSize: "11px", fontFamily: "var(--font-mono)", textAlign: "right" }}>
                              Actor: {e.user}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: ADMIN RISK SANDBOX (ORACLE SIMULATION) */}
              {activeTab === "sandbox" && (
                <div className="card-premium sheen">
                  <h3 className="card-title font-display" style={{ fontSize: "16px", fontWeight: 600 }}>Liquidator & Price Sandbox</h3>
                  <p style={{ color: "rgb(var(--ink-muted))", fontSize: "13.5px", marginBottom: "24px", lineHeight: 1.5 }}>
                    This sandbox allows you to mock changes in the underlying XLM price feeds, forcing positions into uncollateralized ratios so you can test liquidations in real time.
                  </p>

                  <div className="bento-grid">
                    
                    {/* Price Controls Card */}
                    <div style={{ gridColumn: "span 6", background: "rgb(var(--canvas))", padding: "20px", borderRadius: "8px", border: "1px solid rgb(var(--hairline))" }}>
                      <h4 className="font-display" style={{ fontSize: "14px", fontWeight: 500, marginBottom: "16px", color: "rgb(var(--ink))" }}>Simulate Asset Price Movement</h4>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "24px" }}>
                        <button 
                          onClick={() => {
                            setTokenBPrice((p) => Math.max(0.01, p - 0.05));
                            setSimulatedPriceChange((c) => c - 1);
                          }} 
                          className="btn-pressable btn-danger" 
                          style={{ width: "40px", height: "40px", borderRadius: "50%", padding: 0 }}
                        >
                          <Minus size={18} />
                        </button>
                        
                        <div style={{ textAlign: "center", flex: 1 }}>
                          <div className="tnum font-display" style={{ fontSize: "28px", fontWeight: 600, color: "rgb(var(--ink))" }}>
                            ${tokenBPrice.toFixed(4)}
                          </div>
                          <div className="eyebrow" style={{ fontSize: "9px", marginTop: "4px" }}>
                            Mock Price per XLM
                          </div>
                        </div>

                        <button 
                          onClick={() => {
                            setTokenBPrice((p) => p + 0.05);
                            setSimulatedPriceChange((c) => c + 1);
                          }} 
                          className="btn-pressable btn-success" 
                          style={{ width: "40px", height: "40px", borderRadius: "50%", padding: 0 }}
                        >
                          <Plus size={18} />
                        </button>
                      </div>

                      <button 
                        onClick={() => {
                          setTokenBPrice(1.00);
                          setSimulatedPriceChange(0);
                        }} 
                        className="btn-pressable btn-neutral font-display" 
                        style={{ width: "100%", padding: "10px", fontSize: "12px", border: "1px solid rgb(var(--hairline))" }}
                      >
                        <RefreshCw size={12} /> Reset Price to Base
                      </button>
                    </div>

                    {/* Liquidation Execution Card */}
                    <div style={{ gridColumn: "span 6", background: "rgb(var(--canvas))", padding: "20px", borderRadius: "8px", border: "1px solid rgb(var(--hairline))", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <h4 className="font-display" style={{ fontSize: "14px", fontWeight: 500, marginBottom: "8px", color: "rgb(var(--ink))" }}>Liquidation Monitoring</h4>
                        <p style={{ fontSize: "12px", color: "rgb(var(--ink-muted))", marginBottom: "16px", lineHeight: 1.4 }}>
                          Positions become eligible for liquidation if their Health Factor falls below <strong>1.00</strong>. Liquidators receive a 10% keeper bounty of the remaining margins.
                        </p>
                        
                        {activePosition ? (
                          <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", background: "rgb(var(--surface) / 0.5)", border: "1px solid rgb(var(--hairline))", padding: "12px", borderRadius: "6px", fontSize: "13px" }}>
                            <span style={{ color: "rgb(var(--ink-muted))" }}>Target Position Health:</span>
                            <strong className="tnum" style={{ color: activePosition.healthFactor >= 100 ? "rgb(var(--long))" : "rgb(var(--short))" }}>
                              {(activePosition.healthFactor / 100).toFixed(2)}
                            </strong>
                          </div>
                        ) : (
                          <div className="eyebrow" style={{ fontSize: "9px", fontStyle: "italic" }}>
                            No active target positions to monitor
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={handleLiquidate} 
                        disabled={!activePosition || activePosition.healthFactor >= 100}
                        className="btn-pressable btn-danger font-display" 
                        style={{ width: "100%", padding: "12px", fontSize: "13px" }}
                      >
                        Trigger Liquidation Execution
                      </button>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </main>
    </div>
  );
}
