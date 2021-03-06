uniform vec2 iResolution;
uniform float iTime;
uniform float iFrame;

#define M_PI 3.1415926535897932384626433832795

#define RAY_MIN_LENGTH 0.000000001
#define INFINITY 100000000000.0
#define RAY_MAX_DEPTH 5

#define IOR_AIR 1.00
#define IOR_WATER 1.3333
#define IOR_ICE 1.31
#define IOR_GLASS 1.52
#define IOR_DIAMOND 2.42

#define N_SPHERES 5
#define N_PLANES 3
#define N_LIGHTS 2

struct CameraSize {
    float width;
    float height;
};

struct Camera {
    vec3 origin;
    vec3 target;
    vec3 forward;
    vec3 right;
    vec3 up;
    CameraSize size;
};

struct Material {
    vec3 color;
    float damping;
    float reflectivity;
    float refractivity;
    float ior;
};

struct RayIntersection {
    float t;
    Material mat;
    vec3 normal;
};

struct Ray {
    vec3 origin;
    vec3 direction;
};

struct Sphere {
    vec3 position;
    float radius;
    Material mat;
};

struct Plane {
    vec3 position;
    vec3 normal;
    Material mat;
};

struct Light {
    vec3 position;
    vec3 color;
    float force;
};

struct Scene {
    Light lights[N_LIGHTS];
    Sphere spheres[N_SPHERES];
    Plane planes[N_PLANES];
};

vec3 rgb2vec(int r, int g, int b) {
    return vec3(float(r)/255.0, float(g)/255.0, float(b)/255.0);
}

bool intersect(Ray ray, Sphere sphere, inout RayIntersection intersection) {
    // Transform ray so we can consider origin-centred sphere
    Ray localRay;
    localRay.origin = ray.origin - sphere.position;
    localRay.direction = ray.direction;

    // Calculate quadratic coefficients
    float a = dot(localRay.direction, localRay.direction);
    float b = 2.0 * dot(localRay.direction, localRay.origin);
    float c = dot(localRay.origin, localRay.origin) - sphere.radius * sphere.radius;

    // Check whether we intersect
    float discriminant = b * b - 4.0 * a * c;

    if (discriminant < 0.0) {
        return false;
    }

    // Find two points of intersection, t1 close and t2 far
    float t1 = (-b - sqrt(discriminant)) / (2.0 * a);
    float t2 = (-b + sqrt(discriminant)) / (2.0 * a);

    // First check if close intersection is valid
    if (t1 > RAY_MIN_LENGTH && t1 < intersection.t) {
        intersection.t = t1;
        intersection.mat = sphere.mat;
        intersection.normal = normalize(ray.origin + ray.direction * t1 - sphere.position);
        return true;
    } else {
        // Neither is valid
        return false;
    }
}

bool intersect(Ray ray, Plane plane, inout RayIntersection intersection) {
    // First, check if we intersect
    float dDotN = dot(ray.direction, plane.normal);

    if (dDotN == 0.0) {
        // We just assume the ray is not embedded in the plane
        return false;
    }

    // Find point of intersection
    float t = dot(plane.position - ray.origin, plane.normal) / dDotN;

    if (t <= RAY_MIN_LENGTH || t >= intersection.t) {
        // Outside relevant range
        return false;
    }

    intersection.t = t;
    intersection.mat = plane.mat;
    intersection.normal = plane.normal;

    return true;
}

Camera createCamera(vec3 origin, vec3 target, float fov, float aspectRatio, vec3 upGuide) {
    Camera camera;

    camera.origin = origin;
    camera.target = target;
    camera.forward = normalize(target - origin);
    camera.right = normalize(cross(camera.forward, upGuide));
    camera.up = normalize(cross(camera.right, camera.forward));
    camera.size.height = tan(radians(fov) * 0.5);
    camera.size.width = camera.size.height * aspectRatio;

    return camera;
}

Ray createRayFromCamera(Camera camera) {
    vec2 px = gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0;
    vec3 xOffset = camera.right * px.x * camera.size.width;
    vec3 yOffset = camera.up * px.y * camera.size.height;
    vec3 rayDirection = camera.forward + xOffset + yOffset;

    Ray ray = Ray(camera.origin, rayDirection);
    return ray;
}

void trace(Ray ray, Scene scene, out RayIntersection intersection) {
    for (int i = 0; i < N_SPHERES; i++) intersect(ray, scene.spheres[i], intersection);
    for (int i = 0; i < N_PLANES; i++) intersect(ray, scene.planes[i], intersection);
}

void trace(vec3 origin, vec3 direction, Scene scene, out RayIntersection intersection) {
    Ray ray = Ray(origin, direction);
    for (int i = 0; i < N_SPHERES; i++) intersect(ray, scene.spheres[i], intersection);
    for (int i = 0; i < N_PLANES; i++) intersect(ray, scene.planes[i], intersection);
}

vec3 castRay(Ray ray, Scene scene) {

    vec3 finalColor = vec3(0.0);
    float frac = 1.0;

    for (int raybounce = 0; raybounce < RAY_MAX_DEPTH; raybounce++) {
        bool breakBounceLoop = false;
        Ray nextRay;
        float nextFrac = 1.0;

        RayIntersection obj;
        obj.t = INFINITY;
        trace(ray, scene, obj);

        if (obj.t >= INFINITY) {
            breakBounceLoop = true;
        } else {
            vec3 rayHit = ray.origin + ray.direction * obj.t;
            vec3 diffuse = vec3(0.0);
            vec3 specular = vec3(0.0);
            vec3 reflection = vec3(0.0);
            vec3 refraction = vec3(0.0);

            for (int i = 0; i < N_LIGHTS; i++) {
                vec3 rayHitToLight = scene.lights[i].position - rayHit;
                vec3 lightDirection = normalize(rayHitToLight);
                float lightDstSq = dot(rayHitToLight, rayHitToLight);
                float distanceFade = 1.0 / lightDstSq;

                // --------------------------------------------------------
                // Diffuse
                float brightness = 0.2 * distanceFade;
                vec3 lightRayOrigin = rayHit + (obj.normal * 0.001);
                RayIntersection lightIntersection;
                lightIntersection.t = INFINITY;
                trace(lightRayOrigin, normalize(lightDirection), scene, lightIntersection);

                if (lightIntersection.t * lightIntersection.t > lightDstSq) {
                    float lightOnSurface = max(0.0, dot(obj.normal, lightDirection));
                    brightness += 0.8 * lightOnSurface * (scene.lights[i].force * distanceFade);
                }

                diffuse += obj.mat.color * brightness;

                // --------------------------------------------------------
                // https://youtu.be/GZ_1xOm-3qU?t=391
                // Specular
                vec3 reflectedLightDirection = reflect(lightDirection, obj.normal);
                float specularFactor = max(0.0, dot(reflectedLightDirection, ray.direction));
                float dampedSpecular = pow(specularFactor, obj.mat.damping);
                specular += dampedSpecular * distanceFade;
            }

            // --------------------------------------------------------
            // Reflection || Refraction
            if (obj.mat.reflectivity > 0.0) {
                nextRay = Ray(rayHit, reflect(ray.direction, obj.normal));
                nextFrac *= obj.mat.reflectivity;
            } else if (obj.mat.refractivity > 0.0) {
                nextRay = Ray(rayHit + ray.direction * 0.0001, refract(ray.direction, obj.normal, IOR_AIR / obj.mat.ior));
                nextFrac *= obj.mat.refractivity;
            } else {
                breakBounceLoop = true;
            }

            // --------------------------------------------------------
            // Add up diffuse, specular, reflection and refraction
            vec3 diffSpecRefrac = mix(diffuse + specular, refraction, obj.mat.refractivity);
            finalColor += diffSpecRefrac * frac;
            // vec3 diffSpecReflec = mix(diffuse + specular, reflection, obj.mat.reflectivity);
            // finalColor += (diffSpecReflec + refraction) * frac;
        }

        if (breakBounceLoop || frac < 0.01) {
            break;
        } else  {
            frac = nextFrac;
            ray = nextRay;
        }
    } // end for raybounce

    if (finalColor.r + finalColor.g + finalColor.b == 0.0) {
        return vec3(1.0);
    }
    return finalColor;
}

void fillScene(out Scene scene) {
    scene.spheres[0] = Sphere(vec3(1.0, 0, -6.0), 0.2, Material(rgb2vec(255, 32, 32), 1.0, 0.0, 1.0, IOR_GLASS));
    scene.spheres[1] = Sphere(vec3(-1.0, 0, -8.0), 1.0, Material(rgb2vec(0, 255, 190), 100.0, 0.4, 0.0, 0.0));
    //scene.spheres[2] = Sphere(vec3(1.0, 0, -6.0), 1.0, Material(rgb2vec(0, 100, 255), 100.0, 0.7, 0.0, 0.0));
    scene.spheres[2] = Sphere(vec3(1.0, 0, -6.0), 1.0, Material(rgb2vec(0, 100, 255), 100.0, 0.7, 0.0, 0.0));
    scene.planes[0] = Plane(vec3(0.0, -2.0, 0.0), vec3(0.0, 1.0, 0.0), Material(rgb2vec(100, 100, 100), 1.0, 0.0, 0.0, 0.0));
    scene.planes[1] = Plane(vec3(-3.5, 0.0, -15.0), vec3(1.0, 0.0, 0.5), Material(rgb2vec(100, 100, 255), 1.0, 0.0, 0.0, 0.0));
    scene.planes[2] = Plane(vec3(3.5, 0.0, -15.0), vec3(-1.0, 0.0, 0.5), Material(rgb2vec(255, 100, 100), 1.0, 0.0, 0.0, 0.0));
    scene.lights[0] = Light(vec3(1.0, 4.0, 2.0), vec3(1.0), 54.0);
    scene.lights[1] = Light(vec3(-4.0, 4.0, 2.0), vec3(1.0), 21.0);
}

void main() {
    vec3 camOrigin = vec3(0.0, 2.0, 1.0);
    vec3 camTarget = vec3(0.0, -0.2, -8.0);
    vec3 camUpGuide = vec3(0.0, 1.0, 0.0);
    float camFov = 45.0;
    float camAspectRatio = iResolution.x / iResolution.y;
    Camera camera = createCamera(camOrigin, camTarget, camFov, camAspectRatio, camUpGuide);

    Ray cameraRay = createRayFromCamera(camera);
    Scene scene;
    fillScene(scene);

    scene.spheres[0].position.x += cos(iTime) * 1.4;
    scene.spheres[0].position.z += sin(iTime) * 1.4;
    scene.spheres[1].position.y += sin(iTime * 0.5) * 0.3;
    scene.spheres[2].position.y += cos(iTime * 0.5) * 0.3;
    //scene.lights[0].position.x += cos(iTime) * 3.0;
    //scene.lights[0].position.y += sin(iTime) * 3.0;
    //scene.planes[0].position.y += cos(iTime);

    vec3 color = castRay(cameraRay, scene);

    gl_FragColor = vec4(color, 1.0);
 }
