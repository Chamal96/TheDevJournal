AWS වල cloud journey එක පටන් ගන්නකොට හෝ scale කරන්නකොට ඒකාන්තයෙන්ම ඔයාට හම්බවෙන ලොකුම confusion එකක් තමයි — මගේ application එකට හරියන EC2 instance type එක මොකක්ද? කියන ප්‍රශ්නය.

AWS console open කරලා instance type list එක බලනකොට `t3.micro`, `c5.xlarge`, `r6g.2xlarge`, `p4d.24xlarge` කියලා ගොඩක් ඒවා පෙනෙනවා. ඒ ඒ series වල වෙනස ලේසියෙන් නොතේරෙනවා නම් — මේ blog post එකෙන් ඒ ගැටලුව solve කරගන්න පුළුවන්.

EC2 instance families 5ක් ගැන detail විදිහට කතා කරමු. ඒ ඒ family ගත්තේ ඇයි, real-world use case මොකක්ද, cost-wise හොඳ choices මොනවාද — ඒ සියල්ල cover කරමු.

## 1. General Purpose — Balance is Everything

EC2 families අතරින් වැඩිම popular එක — T-Series සහ M-Series. CPU, Memory, සහ Network balance කරලා ලැබෙන නිසා everyday workloads වලට perfectly fit වෙනවා.

**T-Series (T3, T3a, T4g):** Burstable Performance concept එක මේ series එකේ core idea. Normal load එකෙදී CPU credits collect කරගෙන suddenly high load ආවාම burst කරනවා. Small web apps, dev/test environments, CI/CD pipelines වලට `T3.micro` හෝ `T3.small` නිවැරදිම choice. AWS free tier එක `t2.micro`/`t3.micro` ලෙස දෙන්නේ ඒ නිසාම.

**M-Series (M5, M6g, M7g):** Production-grade, enterprise-level applications වලට M-series. Predictable performance ලැබෙනවා. Burstable නෙවෙයි — consistent CPU power. REST APIs, backend services, CMS platforms වලට `M5.large` හෝ `M6g.large` ගත්තොත් long-term cost vs performance balance හොඳයි.

Pro tip: M6g/M7g (Graviton) choose කළොත් ARM-based architecture නිසා on-demand price ට compare කරද්දී ~20% cheaper. Same performance, less cost.

## 2. Compute Optimized — Raw CPU Power

ඔයාගේ application CPU-intensive නම් — CPU % consistently high නම් — General Purpose instance ගන්නේ අපරාදයක්. ඒකට C-Series (C5, C6g, C7g) specifically design කරලා තිබෙනවා.

High CPU-to-memory ratio ලැබෙන නිසා computing power max ගන්න ඕන workloads වලට මේවා ideal. Video transcoding pipelines, FFmpeg-based processing, scientific simulations, high-traffic web servers (NGINX/HAProxy) වැනි scenarios වලදී C5 family choose කරන්නේ performance gain එක පැහැදිලිවම පෙනෙන නිසයි.

Gaming servers deploy කරනවා නම් low latency + high throughput ඕන නිසා C-series + placement groups combination එක excellent.

## 3. Memory Optimized — Data in RAM

ලොකු dataset RAM එකේ load කරගෙන fast access ඕනනම් — disk I/O overhead avoid කරන්නනම් — R-Series සහ X-Series perfect match.

**R-Series (R5, R6g, R7g):** High memory-to-CPU ratio. In-memory caching (Redis, Memcached), relational databases (MySQL, PostgreSQL) handle කරන deployments වලට `R5.xlarge` හෝ `R6g.xlarge` excellent starting point.

**X-Series (X1, X2gd):** Extreme memory workloads. Single instance එකකට 1TB+ RAM පවා ලැබෙනවා. SAP HANA, large-scale in-memory databases වැනි enterprise-level applications වලට පාවිච්චි කරයි.

## 4. Accelerated Computing — GPU Power

GPU-based workloads, AI/ML training, graphics rendering වලට CPU එක විතරක් මදි. ඒකට තමයි P-Series සහ G-Series තියෙන්නේ.

**P-Series (P3, P4, P5):** NVIDIA A100/H100 GPUs. Deep learning model training, LLM fine-tuning කරන ML Engineers ලට P-series තමයි standard choice.

**G-Series (G4dn, G5):** NVIDIA T4/A10G GPUs. ML inference (trained models serve කරන්න), 3D rendering, video streaming වලට `G4dn.xlarge` cost-effective choice එකක්.

## 5. Storage Optimized — High-Speed I/O

Millions of records fast read/write කරනවා නම්, high IOPS workloads run කරනවා නම් — I-Series සහ D-Series තමයි විසඳුම.

**I-Series (I3, I4i):** NVMe SSD local storage. Low latency, high random IOPS. NoSQL databases (Cassandra, MongoDB) වලට ideal.

**D-Series (D2, D3):** Dense HDD storage. Hadoop HDFS, data warehousing වැනි sequential reads/writes වැඩි වැඩ වලට පාවිච්චි කරයි.

## Infrastructure as Code: AWS CDK Example

මේ තියෙන්නේ AWS CDK (TypeScript) පාවිච්චි කරලා කොහොමද Graviton processor එකක් තියෙන instance එකක් සහ EBS storage එකක් ලේසියෙන් setup කරගන්නේ කියලා.

```typescript
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class Ec2BlogStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, "MyVPC", { isDefault: true });

    // Creating a Graviton-based M6g instance
    new ec2.Instance(this, "MyGravitonInstance", {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M6G, ec2.InstanceSize.LARGE),
      machineImage: ec2.MachineImage.latestAmazonLinux2({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64, // Specify ARM for Graviton
      }),
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(30, {
            volumeType: ec2.EbsDeviceVolumeType.GP3, // Fast & cost-effective storage
          }),
        },
      ],
    });
  }
}
```

## Cost Optimization — 3 Rules to Live By

**Right-sizing:** CloudWatch metrics බලලා utilization 20% ට වඩා අඩු නම් අනිවාර්යයෙන්ම instance එක downsize කරන්න. AWS Compute Optimizer tool එක මේකට ගොඩක් උදව් වෙනවා.

**Graviton (g-series) first:** පුළුවන් හැමවෙලේම ARM-based Graviton instances (T4g, M7g, C7g) පාවිච්චි කරන්න. ඒකෙන් 40% විතර price-performance benefit එකක් ලැබෙනවා.

**Spot Instances:** Fault-tolerant වැඩ වලට (batch jobs, ML training) Spot instances පාවිච්චි කරලා 70–90% දක්වා වියදම අඩු කරගන්න.

## Conclusion

ඔයා දැනට පාවිච්චි කරන්නේ මොන instance family එකද? ඒකෙන් ලැබෙන performance ගැන ඔයා සතුටුද?
