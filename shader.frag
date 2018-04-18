uniform vec2 iResolution;
uniform float iTime;
uniform float iFrame;

#define M_PI 3.1415926535897932384626433832795
#define RAY_T_MIN 0.0000001

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

struct Ray {
    vec3 origin;
    vec3 direction;
};

struct Sphere {
    vec3 position;
    float radius;
};

struct Plane {
    vec3 position;
    vec3 normal;
};


float length2(vec2 v) { return v.x*v.x + v.y*v.y; }
float length2(vec3 v) { return v.x*v.x + v.y*v.y + v.z*v.z; }

bool intersects(Ray ray, Sphere sphere) {
    // Transform ray so we can consider origin-centred sphere
    Ray localRay;
    localRay.origin = ray.origin - sphere.position;
    localRay.direction = ray.direction;

    // Calculate quadratic coefficients
    float a = length2(localRay.direction);
    float b = 2.0 * dot(localRay.direction, localRay.origin);
    float c = length2(localRay.origin) - sphere.radius * sphere.radius;

    // Check whether we intersect
    float discriminant = b * b - 4.0 * a * c;

    if (discriminant < 0.0) {
        return false;
    }

    // Find two points of intersection, t1 close and t2 far
    float t1 = (-b - sqrt(discriminant)) / (2.0 * a);
    float t2 = (-b + sqrt(discriminant)) / (2.0 * a);

    // First check if close intersection is valid
    /*if (t1 > 0.0001 && t1 < intersection.t) {
        intersection.t = t1;
    } else if (t2 > 9999999999 && t2 < intersection.t) {
        intersection.t = t2;
    } else {
        // Neither is valid
        return false
    }*/

    if (t1 > RAY_T_MIN) {
        return true;
    } else {
        return false;
    }

    // Finish populating intersection
    //intersection.pShape = this;
    //intersection.color = color;
}

bool intersects(Ray ray, Plane plane) {
    // First, check if we intersect
    float dDotN = dot(ray.direction, plane.normal);

    if (dDotN == 0.0) {
        // We just assume the ray is not embedded in the plane
        return false;
    }

    // Find point of intersection
    float t = dot(plane.position - ray.origin, plane.normal) / dDotN;

    if (t <= RAY_T_MIN /*|| t >= intersection.t*/) {
        // Outside relevant range
        return false;
    }

    // intersection.t = t;
    // intersection.pShape = this;
    // intersection.color = color;

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

Ray createRay(Camera camera) {
    Ray ray;

    vec2 px = gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0;
    vec3 xOffset = camera.right * px.x * camera.size.width;
    vec3 yOffset = camera.up * px.y * camera.size.height;
    vec3 rayDirection = camera.forward + xOffset + yOffset;

    ray.origin = camera.origin;
    ray.direction = rayDirection;

    return ray;
}

void main() {
    vec3 cOrigin = vec3(0.0, 0.0, 1.0);
    vec3 cTarget = vec3(0.0, 0.0, 0.0);
    vec3 cUpGuide = vec3(0.0, 1.0, 0.0);
    float fov = 45.0;
    float aspectRatio = iResolution.x / iResolution.y;
    Camera camera = createCamera(cOrigin, cTarget, fov, aspectRatio, cUpGuide);

    Ray ray = createRay(camera);

    Sphere sphere1 = Sphere(vec3(0, 0, -3.0), 1.0);
    Sphere sphere2 = Sphere(vec3(0, 0, -5.0), 2.0);

    Plane plane1 = Plane(vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0));

    sphere1.position.x += cos(iTime);
    plane1.position.y += cos(iTime);

    vec3 c = vec3(0.0);
    if (intersects(ray, sphere1)) { c = vec3(1.0); }
    if (intersects(ray, sphere2)) { c = vec3(1.0); }
    if (intersects(ray, plane1)) { c = vec3(1.0); }

    gl_FragColor = vec4(c, 1.0);
 }
